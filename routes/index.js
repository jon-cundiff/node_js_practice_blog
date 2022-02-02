const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const unauthMiddleware = require("../util/unauthMiddleware");

const createIndexRouter = (db) => {
    router.get("/", async (req, res) => {
        const posts = await db.any(
            `SELECT
                posts.post_id, posts.title, body, posts.date_created, is_published, COUNT(comments) AS comment_count 
            FROM
                posts LEFT JOIN comments ON posts.post_id = comments.post_id
            WHERE 
                is_published = true
            GROUP BY
                posts.post_id`
        );

        res.render("index", { posts });
    });

    router.get("/signup", unauthMiddleware, (req, res) => {
        res.render("signup");
    });

    router.post("/signup", unauthMiddleware, async (req, res) => {
        if (req.session && req.session.username) {
            res.redirect("/posts/my-posts");
        }
        const { username, email, firstname, lastname, password, repeat } =
            req.body;
        try {
            if (!username || !email || !password || !repeat) {
                throw new Error(
                    "Username, Email, Password, and Repeat Password fields are required!"
                );
            } else if (password.trim() !== repeat.trim()) {
                throw new Error("Passwords don't match!");
            }

            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            const user = await db.one(
                "INSERT INTO users(username, email, first_name, last_name, password) VALUES ($1, $2, $3, $4, $5) RETURNING username, user_id",
                [username, email, firstname, lastname, hash]
            );
            req.session.username = user.username;
            req.session.userid = user.user_id;
            return res.redirect("/posts/my-posts");
        } catch (err) {
            if (err.name === "error") {
                // pg-promise uses lowercase error rather than leading cap Error
                if (err.code === "23505") {
                    // username and email are set as UNIQUE on the DB, this code indicates username or email already in DB
                    res.locals.error =
                        "Username taken or Email already attached to account.";
                } else {
                    res.locals.error =
                        "Error signing up. Please try again later.";
                }
            } else {
                res.locals.error = err;
            }
            res.render("signup");
        }
    });

    router.get("/login", unauthMiddleware, (req, res) => {
        res.render("login");
    });

    router.post("/login", unauthMiddleware, async (req, res) => {
        const { username, password } = req.body;

        try {
            const user = await db.one(
                "SELECT username, password, user_id FROM users WHERE username = $1",
                [username]
            );
            const result = await bcrypt.compare(password, user.password);
            if (!result) {
                throw new Error("Incorrect Password");
            }
            req.session.username = user.username;
            req.session.userid = user.user_id;
            res.redirect("/posts/my-posts");
        } catch (err) {
            res.locals.error = "Username or Password does not match!";
            res.render("login");
        }
    });

    router.get("/logout", (req, res) => {
        req.session.username = null;
        req.session.userid = null;
        res.redirect("/");
    });

    return router;
};

module.exports = createIndexRouter;
