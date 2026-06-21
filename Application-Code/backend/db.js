const mongoose = require("mongoose");

module.exports = async () => {
    try {
        const connectionParams = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        };

        await mongoose.connect(
            process.env.MONGODB_URI,
            connectionParams
        );

        console.log("Connected to database.");
    } catch (error) {
        console.log("Could not connect to database.", error);
    }
};
