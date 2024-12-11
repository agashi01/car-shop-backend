require('dotenv').config()
const { makeApp } = require('./app.js')
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { db } = require('./db.js')

const app = express()

const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "guest"],
};

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json());
app.options("*", cors(corsOptions));

cloudinary.config({
    cloud_name: process.env.CLOUDNAME,
    api_key: process.env.APIKEY,
    api_secret: process.env.APISECRET,
});

const authenticate = (req, res, next) => {
    app.disable("x-powered-by");
    if (req.headers.guest === 'true') {
        return next();
    } else if (req.headers.guest === 'false') {
        const authorization = req.headers.authorization;
        const token = authorization && authorization.split(" ")[1];
        if (!token) return res.status(400).json("you dont have a token in authorization");
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {

            if (err) {
                if (err.name === "TokenExpiredError") {
                    return res.status(401).json("Token has expired");
                } else if (err.name === "JsonWebTokenError") {
                    return res.status(403).json("Invalid token");
                } else {
                    return res.status(403).json("Token verification failed");
                }
            }
            req.user = user
            return next()

        })
    } else {
        return res.status(404).json("guest parameter is missing");
    }
};

makeApp(express, app, multer, cloudinary, db, authenticate)

const PORT =process.env.PORT||3000
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
