const resLocalsMiddleware = (req, res, next) => {
    if (req.session && req.session.username) {
        res.locals.username = req.session.username;
    } else {
        res.locals.username = "";
    }
    next();
};

module.exports = resLocalsMiddleware;
