const express = require("express");
const session = require("express-session");
const mustacheExpress = require("mustache-express");

const readEnv = require("./readenv");
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

app.get("/", async (req, res) => {
    const posts = await db.any(
        "SELECT post_id, title, body, date_created, date_updated FROM posts WHERE is_published = true"
    );

    res.render("index", { posts });
});

app.get("/new-post", (req, res) => {
    res.render("newPost", { postUrl: "/new-post", buttonLabel: "Add" });
});

app.post("/new-post", async (req, res) => {
    const { title, body, publish } = req.body;
    await db.none(
        "INSERT INTO posts(title, body, is_published) VALUES ($1, $2, $3)",
        [
            title,
            body,
            !!publish // checkbox gives values undefined or 'on', double ! forces into boolean
        ]
    );
    res.redirect("/");
});

app.get("/my-posts", async (req, res) => {
    const posts = await db.any(
        "SELECT post_id, title, body, date_created, date_updated is_published FROM posts"
    );

    res.render("myPosts", { posts, edit: true });
});

app.get("/posts/:postId/edit", async (req, res) => {
    const postId = parseInt(req.params.postId);
    const post = await db.oneOrNone(
        "SELECT post_id, title, body, date_created, date_updated, is_published FROM posts WHERE post_id = $1",
        [postId]
    );

    if (!post) {
        return res.redirect("/my-posts");
    }
    res.render("editPost", {
        title: post.title,
        body: post.body,
        isPublished: post.is_published,
        postUrl: `/posts/${post.post_id}/edit`,
        buttonLabel: "Update"
    });
});

app.post("/posts/:postId/edit", async (req, res) => {
    const { title, body, publish } = req.body;
    const postId = parseInt(req.params.postId);
    await db.none(
        "UPDATE posts SET title = $1, body = $2, is_published = $3, date_updated = current_timestamp WHERE post_id = $4",
        [title, body, publish, postId]
    );
    res.redirect("/my-posts");
});

app.get("/posts/:postId/delete", async (req, res) => {
    const postId = parseInt(req.params.postId);
    const post = await db.oneOrNone(
        "SELECT post_id, title FROM posts WHERE post_id = $1",
        [postId]
    );
    if (!post) {
        return res.redirect("/my-posts");
    }

    res.render("confirmDelete", { title: post.title, postId: post.post_id });
});

app.post("/posts/:postId/delete", async (req, res) => {
    const postId = parseInt(req.params.postId);
    await db.none("DELETE FROM posts WHERE post_id = $1", [postId]);
    res.redirect("/my-posts");
});

app.listen(PORT, () => console.log(`Blog app running on port ${PORT}`));
