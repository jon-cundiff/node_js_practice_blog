const fs = require("fs");

const readEnv = () => {
    const envRaw = fs.readFileSync("./.env", "utf-8");
    const envPairs = {};
    envRaw.split("\n").forEach((env) => {
        const [key, value] = env.split("=");
        envPairs[key] = value;
    });
    return [envPairs.DBURL, envPairs.SECRET];
};

module.exports = readEnv;
