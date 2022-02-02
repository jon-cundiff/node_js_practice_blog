const unauthMiddleware = (req, res, next) => {
    if (req.session && req.session.username) {
        return res.redirect("/posts/my-posts");
    }

    next();
};

module.exports = unauthMiddleware;
