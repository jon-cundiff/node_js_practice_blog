const express = require("express");
const router = express.Router();
const userAuthMiddleware = require("../util/userAuthMiddleware");

const createPostsRouter = (db) => {
    router.get("/", (req, res) => res.redirect("/"));

    router.get("/new-post", userAuthMiddleware, (req, res) => {
        res.render("newPost", {
            postUrl: "/posts/new-post",
            buttonLabel: "Add"
        });
    });

    router.post("/new-post", userAuthMiddleware, async (req, res) => {
        const { title, body, publish } = req.body;
        await db.none(
            "INSERT INTO posts(title, body, is_published, user_id) VALUES ($1, $2, $3, $4)",
            [
                title,
                body,
                !!publish, // checkbox gives values undefined or 'on', double ! forces into boolean
                req.session.userid
            ]
        );
        res.redirect("/posts/");
    });

    router.get("/my-posts", userAuthMiddleware, async (req, res) => {
        const posts = await db.any(
            `SELECT
                posts.post_id, posts.title, body, posts.date_created, is_published, COUNT(comments) AS comment_count 
            FROM
                posts LEFT JOIN comments ON posts.post_id = comments.post_id
            WHERE 
                is_published = true AND
                posts.user_id = $1
            GROUP BY
                posts.post_id`,
            [req.session.userid]
        );

        res.render("myPosts", { posts, edit: true });
    });

    router.get("/:postId", async (req, res) => {
        const postId = parseInt(req.params.postId);
        const post = await db.oneOrNone(
            `SELECT
                posts.post_id,
                posts.title,
                body,
                posts.date_created,
                users.username AS post_user,
                is_published,
                ARRAY(
                    SELECT 
                        username || '&&' || title || '&&' || text || '&&' || comment_id
                    FROM 
                        comments
                        JOIN users ON users.user_id = comments.user_id
                    WHERE
                        comments.post_id = $1
                ) as comments
                FROM
                    posts
                    JOIN users ON users.user_id = posts.user_id
                WHERE
                    is_published = true AND
                    posts.post_id = $1`,
            [postId]
        );

        if (!post) {
            return res.redirect("/posts/my-posts");
        }
        const comments = post.comments.map((comment) => {
            const [user, title, text, commentId] = comment.split("&&");
            return {
                commentUser: user,
                commentTitle: title,
                commentText: text,
                commentId: commentId,
                canDelete:
                    post.post_user === req.session.username ||
                    user === req.session.username
            };
        });
        post.comments = comments;
        res.render("postDetails", {
            post,
            edit: post.post_user === req.session.username
        });
    });

    router.get("/:postId/edit", userAuthMiddleware, async (req, res) => {
        const postId = parseInt(req.params.postId);
        const post = await db.oneOrNone(
            "SELECT post_id, title, body, date_created, date_updated, is_published FROM posts WHERE post_id = $1 AND user_id = $2",
            [postId, req.session.userid]
        );

        if (!post) {
            return res.redirect("/posts/my-posts");
        }
        res.render("editPost", {
            title: post.title,
            body: post.body,
            isPublished: post.is_published,
            postUrl: `/posts/${post.post_id}/edit`,
            buttonLabel: "Update"
        });
    });

    router.post("/:postId/edit", userAuthMiddleware, async (req, res) => {
        const { title, body, publish } = req.body;
        const postId = parseInt(req.params.postId);
        await db.none(
            "UPDATE posts SET title = $1, body = $2, is_published = $3, date_updated = current_timestamp WHERE post_id = $4 AND user_id = $5",
            [title, body, publish, postId, req.session.userid]
        );
        res.redirect("/posts/my-posts");
    });

    router.get("/:postId/delete", userAuthMiddleware, async (req, res) => {
        const postId = parseInt(req.params.postId);
        const post = await db.oneOrNone(
            "SELECT post_id, title FROM posts WHERE post_id = $1 AND user_id = $2",
            [postId, req.session.userid]
        );
        if (!post) {
            return res.redirect("/posts/my-posts");
        }

        res.render("confirmDelete", {
            title: post.title,
            postId: post.post_id
        });
    });

    router.post("/:postId/delete", userAuthMiddleware, async (req, res) => {
        const postId = parseInt(req.params.postId);
        const post = await db.one(
            "SELECT user_id FROM posts WHERE post_id = $1 AND user_id = $2",
            [postId, req.session.userid]
        );

        // Need to double check if user owns posts before deleting comments that reference the post
        if (post) {
            await db.none("DELETE FROM comments WHERE post_id = $1", [postId]);
            await db.none(
                "DELETE FROM posts WHERE post_id = $1 AND user_id = $2",
                [postId, req.session.userid]
            );
        }
        res.redirect("/posts/my-posts");
    });

    router.post("/:postId/:commentId/delete", async (req, res) => {
        const postId = parseInt(req.params.postId);
        const commentId = parseInt(req.params.commentId);
        const sessionUserId = req.session.userid;
        const comment = await db.one(
            `
            SELECT
                posts.user_id as post_user_id,
                comments.user_id as comment_user_id
            FROM
                comments
                JOIN posts ON comments.post_id = posts.post_id
            WHERE
                comments.comment_id = $1 AND
                comments.post_id = $2
        `,
            [commentId, postId]
        );

        if (comment) {
            if (
                comment.comment_user_id === sessionUserId ||
                comment.post_user_id === sessionUserId
            ) {
                await db.none(
                    "DELETE FROM comments WHERE post_id = $1 AND comment_id = $2",
                    [postId, commentId]
                );
            }
        }

        res.redirect(`/posts/${postId}`);
    });

    router.post(
        "/:postId/add-comment",
        userAuthMiddleware,
        async (req, res) => {
            const { title, text } = req.body;
            const postId = parseInt(req.params.postId);
            await db.none(
                "INSERT INTO comments(title, text, user_id, post_id) VALUES($1, $2, $3, $4)",
                [title, text, req.session.userid, postId]
            );

            res.redirect(`/posts/${postId}`);
        }
    );

    return router;
};

module.exports = createPostsRouter;
