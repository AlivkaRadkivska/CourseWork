const mongoose = require("mongoose")

const boughtSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    picture_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Picture",
        required: true
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
})

boughtSchema.virtual('picture', {
    ref: 'Picture',
    localField: 'picture_id',
    foreignField: '_id',
    justOne: true
})

module.exports = mongoose.model("Bought", boughtSchema)