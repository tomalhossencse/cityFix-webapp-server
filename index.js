const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

// firebase admin

const admin = require("firebase-admin");

// const serviceAccount = require("./firebase_key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);

const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(express.json());
app.use(cors());

// verify fb token

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decode = await admin.auth().verifyIdToken(idToken);
    req.decode_email = decode.email;
    // console.log("decode in the token", decode);
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  next();
};

// verify admin
// const verifyAdmin = async (req, res, next) => {
//   const email = req.decoded_email;
//   const query = { email };
//   const user = await usersCollection.findOne(query);
//   if (!user || user?.role !== "admin") {
//     return res.status(403).send({
//       message: "forbidden access",
//     });
//   }
//   next();
// };

// verify Staff

// const verifyStaff = async (req, res, next) => {
//   const email = req.decoded_email;
//   const query = { email };
//   const user = await usersCollection.findOne(query);
//   if (!user || user?.role !== "staff") {
//     return res.status(403).send({
//       message: "forbidden access",
//     });
//   }
//   next();
// };

//mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vybtxro.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // database collecitons

    const cityFixDB = client.db("cityFixDB");
    const issuesCollection = cityFixDB.collection("issues");
    const districtbyRegionCollection = cityFixDB.collection("districtbyRegion");
    const paymentCollection = cityFixDB.collection("payments");
    const PremuimUsersCollection = cityFixDB.collection("premuimUsers");
    const usersCollection = cityFixDB.collection("users");
    const sttafsCollection = cityFixDB.collection("sttafs");
    const upvotesCollection = cityFixDB.collection("upvotes");
    const categoryCollection = cityFixDB.collection("category");
    const howItWorksStepsCollection = cityFixDB.collection("howItWorksSteps");
    const featuresCollection = cityFixDB.collection("features");

    // issue related apis
    app.post("/issues", async (req, res) => {
      const issue = req.body;
      const result = await issuesCollection.insertOne(issue);
      res.send(result);
    });

    app.get("/issues", async (req, res) => {
      try {
        const query = {};
        const { status, priority, category, search } = req.query;

        if (search) {
          query.$or = [
            { issueTitle: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { region: { $regex: search, $options: "i" } },
            { district: { $regex: search, $options: "i" } },
          ];
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await issuesCollection.countDocuments(query);

        const result = await issuesCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .sort({ priority: 1, createAt: -1 })
          .toArray();

        res.send({
          issues: result,
          total: total,
        });
      } catch (error) {
        console.error("Error fetching issues:", error);
        res.status(500).send({ message: "Server error" });
      }
    });
    app.get("/latestIssues", async (req, res) => {
      try {
        const query = {};
        const { status } = req.query;
        if (status) {
          query.status = status;
        }

        const result = await issuesCollection
          .find(query)
          .sort({ createAt: -1, priority: 1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/issues/sttafs", async (req, res) => {
      try {
        const query = {};
        const { status, priority, email, category } = req.query;
        if (email) {
          query["assignedStaff.staffEmail"] = email;

          if (status) query.status = status;

          if (priority) query.priority = priority;

          if (category) query.category = category;
        }
        const result = await issuesCollection
          .find(query)
          .sort({ priority: 1, createAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/my-issues", verifyFBToken, async (req, res) => {
      try {
        const query = {};
        const { status, priority, email, category } = req.query;
        if (email) {
          query.email = email;
          if (status) query.status = status;

          if (priority) query.priority = priority;

          if (category) query.category = category;

          if (email !== req.decode_email) {
            return res.status(403).send({ message: "Forbidden access" });
          }
        }
        const result = await issuesCollection
          .find(query)
          .sort({ priority: 1, createAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/allIssues", async (req, res) => {
      const result = await issuesCollection
        .find()
        .sort({ priority: 1, createAt: -1 })
        .toArray();
      res.send(result);
    });
    // category
    app.get("/category", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });
    // features
    app.get("/features", async (req, res) => {
      const result = await featuresCollection.find().toArray();
      res.send(result);
    });

    // howItWorksSteps
    app.get("/howItWorksSteps", async (req, res) => {
      const result = await howItWorksStepsCollection.find().toArray();
      res.send(result);
    });

    // latest issues

    app.get("/latest-issues", async (req, res) => {
      const result = await issuesCollection
        .find()
        .sort({ createAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get single issues data
    app.get("/issues/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await issuesCollection.findOne(query);
      res.send(result);
    });

    app.get("/payment/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await issuesCollection.findOne(query);
      res.send(result);
    });
    // update issues

    app.patch("/issues/:id", async (req, res) => {
      const { issueTitle, photo, district, region, number, information, area } =
        req.body;
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const updatedocs = {
        $set: {
          issueTitle,
          photo,
          district,
          region,
          number,
          information,
          area,
        },
      };
      const result = await issuesCollection.updateOne(query, updatedocs);
      res.send(result);
    });

    //delete issues
    app.delete("/issues/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await issuesCollection.deleteOne(query);
      res.send(result);
    });

    // update issue timeLine

    app.patch("/issues/:id/timeline", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { assignedStaff, status, message, role } = req.body;
      const timeline = {
        status: status,
        message: message,
        updatedBy: {
          role: role,
          email: req.decode_email,
          name: assignedStaff?.staffName,
        },
        createdAt: new Date(),
      };

      const updateDoc = {
        $set: {
          assignedStaff,
          status,
        },
        $push: { timeline },
      };

      const result = await issuesCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    // district by region apis

    app.get("/districtbyRegion", async (req, res) => {
      const result = await districtbyRegionCollection.find().toArray();
      res.send(result);
    });

    // user related apis

    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(200).send({ message: "Already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/:email", async (req, res) => {
      const { displayName, photoURL } = req.body;
      const email = req.params.email;
      const query = { email };
      const updateDocs = {
        $set: {
          displayName: displayName,
          photoURL: photoURL,
        },
      };
      const result = await usersCollection.updateOne(query, updateDocs);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().skip(1).toArray();
      res.send(result);
    });
    // get single user

    app.get("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const query = { email };
        const result = await usersCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    app.get("/users/:email/role", async (req, res) => {
      const { email } = req.params;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ role: user.role });
    });

    app.patch("/users/:id", async (req, res) => {
      const { accountStatus } = req.body;
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const updatedocs = {
        $set: {
          accountStatus,
        },
      };
      const result = await usersCollection.updateOne(query, updatedocs);
      res.send(result);
    });

    // sttafs related apis

    app.post("/sttafs", async (req, res) => {
      const sttaf = req.body;
      const existingSttaf = await sttafsCollection.findOne({
        email: sttaf.email,
      });
      if (existingSttaf) return;
      const result = await sttafsCollection.insertOne(sttaf);
      res.send(result);
    });

    app.get("/sttafs", async (req, res) => {
      const result = await sttafsCollection.find().toArray();
      res.send(result);
    });

    app.delete("/sttafs/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await sttafsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/sttafs/:id", async (req, res) => {
      const { information, area, district, region, number, category } =
        req.body;
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const updatedocs = {
        $set: {
          information,
          area,
          district,
          region,
          number,
          category,
        },
      };
      const result = await sttafsCollection.updateOne(query, updatedocs);
      res.send(result);
    });

    app.get("/sttafs-filter", async (req, res) => {
      const { region, district, category } = req.query;
      const query = {};

      if (category) {
        query.category = category;
      }
      if (region) {
        query.region = region;
      }

      if (district) {
        query.district = district;
      }

      const result = await sttafsCollection.find(query).toArray();
      res.send(result);
    });
    // upvote related apis

    app.post("/upvotes", async (req, res) => {
      const upvote = req.body;
      const existingUser = await upvotesCollection.findOne({
        issueId: upvote.issueId,
        citzenEmail: upvote.citzenEmail,
      });
      if (existingUser) {
        return res.status(200).send({ message: "Already exists" });
      }
      const result = await upvotesCollection.insertOne(upvote);
      res.send(result);
    });

    app.get("/upvotes/:issueId", async (req, res) => {
      const { issueId } = req.params;
      const query = { issueId };
      const result = await upvotesCollection.find(query).toArray();
      res.send(result);
    });

    // sttaf create

    app.post("/create-staff-auth", async (req, res) => {
      const { email, password, displayName, photoURL } = req.body;

      try {
        const userRecord = await admin.auth().createUser({
          email,
          password,
          displayName,
          photoURL,
        });

        res.send({ uid: userRecord.uid });
      } catch (error) {
        res.status(400).send({ error: error.message });
      }
    });

    // dashboard related apis

    app.get("/dashboard/stats", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;
        const totalIssues = await issuesCollection.countDocuments({
          email,
        });

        const pendingIssues = await issuesCollection.countDocuments({
          email,
          status: "pending",
        });

        const procesingIssues = await issuesCollection.countDocuments({
          email,
          status: "in-progress",
        });
        const workingIssues = await issuesCollection.countDocuments({
          email,
          status: "working",
        });

        const reslovedIssues = await issuesCollection.countDocuments({
          email,
          status: "resolved",
        });

        const closedIssues = await issuesCollection.countDocuments({
          email,
          status: "closed",
        });

        const rejectedIssues = await issuesCollection.countDocuments({
          email,
          status: "rejected",
        });

        const payments = await paymentCollection
          .find({
            customer_email: email,
            paymentStatus: "paid",
          })
          .toArray();

        const totalPayments = payments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );

        res.send({
          issues: {
            total: totalIssues,
            pending: pendingIssues,
            procesing: procesingIssues,
            working: workingIssues,
            resloved: reslovedIssues,
            closed: closedIssues,
            rejected: rejectedIssues,
            totalPayments: totalPayments,
          },
        });
      } catch (error) {
        res.status(500).send({ message: "Dashboard data failed" });
      }
    });

    app.get("/adminDashboard/stats", verifyFBToken, async (req, res) => {
      try {
        const totalIssues = await issuesCollection.countDocuments();

        const pendingIssues = await issuesCollection.countDocuments({
          status: "pending",
        });

        const procesingIssues = await issuesCollection.countDocuments({
          status: "in-progress",
        });
        const workingIssues = await issuesCollection.countDocuments({
          status: "working",
        });

        const reslovedIssues = await issuesCollection.countDocuments({
          status: "resolved",
        });

        const closedIssues = await issuesCollection.countDocuments({
          status: "closed",
        });

        const rejectedIssues = await issuesCollection.countDocuments({
          status: "rejected",
        });

        const payments = await paymentCollection
          .find({
            paymentStatus: "paid",
          })
          .toArray();

        const totalPayments = payments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );

        const totalUsers = await usersCollection.countDocuments({});

        res.send({
          issues: {
            total: totalIssues,
            pending: pendingIssues,
            procesing: procesingIssues,
            working: workingIssues,
            resloved: reslovedIssues,
            closed: closedIssues,
            rejected: rejectedIssues,
            totalPayments: totalPayments,
            totalUsers: totalUsers,
          },
        });
      } catch (error) {
        res.status(500).send({ message: "Dashboard data failed" });
      }
    });

    app.get("/staffDashboard/stats", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const assignedIssues = await issuesCollection
          .find({ "assignedStaff.staffEmail": email })
          .toArray();

        const stats = {
          assignedCount: assignedIssues.length,
          pendingCount: 0,
          inProcessCount: 0,
          workingCount: 0,
          resolvedCount: 0,
          closedCount: 0,
          todaysTasksCount: 0,
        };

        assignedIssues.forEach((issue) => {
          switch (issue.status) {
            case "pending":
              stats.pendingCount++;
              stats.todaysTasksCount++;
              break;
            case "in-progress":
              stats.inProcessCount++;
              stats.todaysTasksCount++;
              break;
            case "working":
              stats.workingCount++;
              stats.todaysTasksCount++;
              break;
            case "resolved":
              stats.resolvedCount++;
              stats.todaysTasksCount++;
              break;
            case "closed":
              stats.closedCount++;
              break;
          }
        });

        res.send({
          staffEmail: email,
          issues: stats,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Dashboard data failed" });
      }
    });

    // payment related api

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "bdt",
              unit_amount: 10000,
              product_data: {
                name: `Please Pay for ${paymentInfo.issueTitle}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: "payment",
        metadata: {
          issueId: paymentInfo.issueId,
          issueTitle: paymentInfo.issueTitle,
          issueTitle: paymentInfo.issueTitle,
          trackingId: paymentInfo.trackingId,
          displayName: paymentInfo.displayName,
          photoURL: paymentInfo.photoURL,
          purpose: "issue",
        },
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
      });
      // console.log(session);
      res.send({ url: session.url });
    });

    app.post("/premium-checkout-session", async (req, res) => {
      const boostInfo = req.body;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "bdt",
              unit_amount: 100000,
              product_data: {
                name: `Please Pay to make  ${boostInfo.displayName} Premuim User`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: boostInfo.email,
        mode: "payment",
        metadata: {
          userId: boostInfo.userId,
          isSubscribed: boostInfo.isSubscribed,
          planType: boostInfo.planType,
          displayName: boostInfo.displayName,
          photoURL: boostInfo.photoURL,
          purpose: "profile",
        },
        success_url: `${process.env.SITE_DOMAIN}/premuim-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/premuim-cancel`,
      });
      // console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      // console.log(sessionId);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // for fixing duplicate payment
      const transactionId = session.payment_intent;
      const existingPayment = await paymentCollection.findOne({
        transactionId,
      });
      if (existingPayment) {
        return res.send({
          success: true,
          message: "Already paid",
          transactionId,
          trackingId: paymentExist.trackingId,
        });
      }
      const trackingId = session.metadata.trackingId;
      if (session.payment_status === "paid") {
        const id = session.metadata.issueId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
            priority: "high",
          },
          $push: {
            timeline: {
              status: "pending",
              message: "Issue Boosted",
              updatedBy: {
                role: "citizen",
                name: session.metadata.displayName,
                email: session.customer_email,
              },
              createdAt: new Date(),
            },
          },
        };

        const result = await issuesCollection.updateOne(
          { ...query, paymentStatus: { $ne: "paid" } },
          update
        );

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customer_name: session.metadata.displayName,
          custormer_photo: session.metadata.photoURL,
          customer_email: session.customer_email,
          issueId: session.metadata.issueId,
          issueTitle: session.metadata.issueTitle,
          trackingId: session.metadata.trackingId,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          purpose: session.metadata.purpose,
        };

        const resultPayment = await paymentCollection.insertOne(payment);
        return res.send({
          success: true,
          modifyParcel: result,
          trackingId: trackingId,
          transactionId: session.payment_intent,
          paymentInfo: resultPayment,
          payment: payment,
        });
      }
      // console.log("session retrieve ", session);
      return res.send({ success: false });
    });

    app.patch("/premuim-success", async (req, res) => {
      const sessionId = req.query.session_id;
      // console.log(sessionId);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // for fixing duplicate payment
      const transactionId = session.payment_intent;
      const premuimUsers = await PremuimUsersCollection.findOne({
        transactionId,
      });
      if (premuimUsers) {
        return res.send({ success: true, message: "Already Premuim" });
      }

      if (session.payment_status === "paid") {
        const id = session.metadata.userId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            isSubscribed: true,
            planType: "premuim",
            transactionId: session.payment_intent,
            paymentStatus: session.payment_status,
            paidAt: new Date(),
          },
        };

        const result = await usersCollection.updateOne(
          { ...query, isSubscribed: { $ne: true } },
          update
        );

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customer_email: session.customer_email,
          userId: session.metadata.userId,
          customer_name: session.metadata.displayName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          custormer_photo: session.metadata.photoURL,
          paidAt: new Date(),
          purpose: session.metadata.purpose,
        };

        const resultPayment = await paymentCollection.insertOne(payment);
        // const resultPayment = await PremuimUsersCollection.insertOne(payment);
        return res.send({
          success: true,
          modifyStatus: result,
          paymentInfo: resultPayment,
        });
      }
      // console.log("session retrieve ", session);
      return res.send({ success: false });
    });

    app.get("/payments", verifyFBToken, async (req, res) => {
      const { purpose } = req.query;
      const query = {};
      if (purpose) {
        query.purpose = purpose;
      }
      const result = await paymentCollection
        .find(query)
        .sort({ paidAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/latestPayments", verifyFBToken, async (req, res) => {
      const result = await paymentCollection
        .find()
        .sort({ paidAt: -1 })
        .limit(4)
        .toArray();
      res.send(result);
    });

    app.get("/latestUsers", verifyFBToken, async (req, res) => {
      const result = await usersCollection
        .find()
        .sort({ paidAt: -1 })
        .limit(4)
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

module.exports = app;