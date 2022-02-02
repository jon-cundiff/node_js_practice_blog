const express = require("express");
const session = require("express-session");
const mustacheExpress = require("mustache-express");

const resLocalsMiddleware = require("./util/resLocalsMiddleware");
const postsRouter = require("./routes/posts");
const indexRouter = require("./routes/index");
const readEnv = require("./util/readenv");
const [connectionString, secret] = readEnv();

const pgp = require("pg-promise")();
const app = express();
const PORT = process.env.PORT || 3000;

app.engine("mustache", mustacheExpress());
app.set("views", "./views");
app.set("view engine", "mustache");

const db = pgp(connectionString);

app.use(
    session({
        secret: secret,
        saveUninitialized: true,
        resave: true
    })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(resLocalsMiddleware);

app.use("/posts", postsRouter(db));
app.use("/", indexRouter(db));

app.listen(PORT, () => console.log(`Blog app running on port ${PORT}`));
