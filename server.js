require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const { engine } = require("express-handlebars");

const app = express();

const studentId = "23NS021";
const productPrefix = studentId.slice(-3);
const lastDigit = Number(studentId.slice(-1));
const vatRate = lastDigit + 5;

app.engine("hbs", engine({
    extname: ".hbs",
    defaultLayout: false
}));

app.set("view engine", "hbs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_WRITE_URI
        }),
        cookie: {
            maxAge: 1000 * 60 * 60
        }
    })
);

const readDB = mongoose.createConnection(
    process.env.MONGO_READ_URI
);

const writeDB = mongoose.createConnection(
    process.env.MONGO_WRITE_URI
);

readDB.once("open", () => {
    console.log("READ database connected");
});

writeDB.once("open", () => {
    console.log("WRITE database connected");
});

app.get("/", async (req, res) => {
    try {
        const books = await readDB
            .collection("books")
            .find({})
            .toArray();

        res.render("home", {
            books: books
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    }
});

app.post("/books", async (req, res) => {
    try {
        const { productCode, name, price } = req.body;

        if (!productCode.startsWith(productPrefix)) {
            return res.status(400).send(
                `Invalid product code. Product code must start with ${productPrefix}.`
            );
        }

        const originalPrice = Number(price);

        if (isNaN(originalPrice) || originalPrice <= 0) {
            return res.status(400).send("Invalid price.");
        }

        const finalPrice =
            originalPrice * (1 + vatRate / 100);

        await writeDB.collection("books").insertOne({
            productCode: productCode,
            name: name,
            originalPrice: originalPrice,
            vatRate: vatRate,
            finalPrice: Number(finalPrice.toFixed(2)),
            createdAt: new Date()
        });

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
