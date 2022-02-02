const userAuthMiddleware = (req, res, next) => {
    if (!req.session || !req.session.username) {
        return res.redirect("/");
    }
    next();
};

module.exports = userAuthMiddleware;
