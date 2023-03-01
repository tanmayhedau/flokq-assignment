const mongoose = require("mongoose");
const express = require("express");
const redis = require("redis");
const kue = require("kue");
const axios = require("axios");
const validUrl = require("valid-url");
const taskModel = require("./src/models/taskModel");

const MONGODB_URL =
  "mongodb+srv://tannmayhedau619:Tanmay%40619@cluster0.fw1xhuw.mongodb.net/task-queue?retryWrites=true&w=majority";

const app = express();
const PORT = process.env.PORT || 5000;
mongoose.set("strictQuery", true);

const client = redis.createClient();
const queue = kue.createQueue();

client.on("connect", function () {
  console.log("connected to Redis");
});

client.on("error", function (err) {
  console.log("Error " + err);
});

queue.on("error", function (err) {
  console.log("Kue Error: ", err);
});

let obj = { name: "xyz" };

//-----------Queue Function------------//

function createJob(myUrl, res) {
  const job = queue
    .create("request", myUrl)
    .priority("high")
    .removeOnComplete(true)
    .ttl(20000)
    .save(async function (err) {
      if (!err) {
        res.send("Your new id for the url is " + job.id);

        client.hset(job.id, "status", "none", redis.print);

        console.log(job.state());
        await taskModel.create({
          jobId: job.id,
          url: myUrl,
          result: JSON.stringify(job),
        });
      } else {
        res.send("There was an error importing your data");
      }
    });
}

function requestStatus(id, res) {
  client.hget(id, "status", function (err, obj) {
    console.log(obj, id);
    if (err) {
      res.send(err);
    } else if (obj == null) {
      res.send("This key does not exist! Check your spelling or try a new key");
    } else if (obj == "none") {
      res.send("This task is still running");
    } else {
      res.send(obj);
    }
  });
}

function processRequest(job, done) {
  axios.get(job.data).then(function (response) {
    client.hset(job.id, "data", response.data, redis.print);
    done();
  });
}

queue.process("request", 5, function (job, done) {
  processRequest(job, done);
});

//---------------- Routes----------------//

app.get("/", function (req, res) {
  res.send("Massdrop Challenge: Create a request and view its status");
});

app.get("/status/:id", function (req, res) {
  requestStatus(req.params["id"], res);
});

app.get("/create/:url", function (req, res) {
  if (validUrl.isHttpUri("http://" + req.params["url"])) {
    createJob("http://" + req.params["url"], res);
  } else {
    res.send("Invalid URL. Please Input a valid URL");
  }
});

mongoose
  .connect(MONGODB_URL, { useNewUrlParser: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`server running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));
