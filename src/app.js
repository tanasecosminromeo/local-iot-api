require('dotenv').config();

const express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    routes = require('./routes'),
    helmet = require('helmet'),
    rateLimit = require('express-rate-limit'),
    xss = require('xss-clean'),
    hpp = require('hpp'),
    cors = require('cors'),
    tokens = process.env.TOKENS ? process.env.TOKENS.split(',') : [],
    port = 3000,
    app_cors = process.env.APP_CORS || '*';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set security headers
app.use(helmet())

// Allow Cross-Origin Requests
app.use(cors({
     origin: app_cors,
}));

// Rate Limiting
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 1000,
    message: {
        error: true,
        message: 'Rate limit exceeded'
    }
});
app.use('/', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({
    limit: '2kb'
}));

// Data sanitization against XSS(clean user input from malicious HTML code)
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

if (tokens.length > 0) {
    // Make sure the user is authenticated
    app.use(function (req, res, next) {
        if (!req.headers.authorization || !tokens.includes(req.headers.authorization)) {
            return res.status(403).json({
                error: true,
                message: 'You are not authorized to access this data.'
            });
        }
        next();
    });
} else {
    console.warn('No tokens set, anyone can access this api!');
}

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", app_cors);
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
});

app.use('/', routes)

app.use(function (req, res, next) {
    res.status(404);
    res.json({
        error: true,
        message: 'Invalid endpoint.'
    });
});

app.listen(
    port,
    () => console.info(
        `App is listening on ${port} ${
            tokens.length > 0 
            ? 'with tokens ' + tokens.length + ' tokens' 
            : 'without authentication required'
        } - Cors Allowed Origin: ${app_cors}`)
)

module.exports = {
    app
}
