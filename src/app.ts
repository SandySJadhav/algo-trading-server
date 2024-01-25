import express from "express";
import searchRouter from "./routes/search";
import cors from "cors";

const app = express();
const corsOpts = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "DELETE"],
};
app.use(cors(corsOpts));
app.use(express.json());

app.use(express.static("public"));

app.use("/search", searchRouter);

// catch 404
app.use(function (req, res) {
  res.redirect("/404.html");
});

export default app;
