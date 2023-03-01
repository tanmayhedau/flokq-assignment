const mongoose = require("mongoose");
const express = require("express");
const redis = require("redis");
const kue = require("kue");
const axios = require("axios");
const validUrl = require("valid-url");
const taskModel = require("./src/models/taskModel");
// require("dotenv").config();
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
        const jobId = job.id;
        res.send("Your new id for the url is " + job.id); // The key to the data is the provided link
        // console.log(job);

        client.hset(job.id, "status", "none", redis.print); // creates a new hashed object {data.id : request}
        // db.collection.save(obj)

        console.log(job.state());
        const result = await taskModel.create({
          jobId: job.id,
          url: myUrl,
          result: JSON.stringify(job),
        });
      } //  request is initally set to none
      else {
        res.send("There was an error importing your data");
      }
    });

  // console.log(job.state());
  // console.log(job);
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
  // Process that grabs the HTML and updates the Redis hash
  axios.get(job.data).then(function (response) {
    client.hset(job.id, "data", response.data, redis.print);
    done();
  });
}

queue.process("request", 5, function (job, done) {
  // the queue can process multiple jobs, currently set to 5
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