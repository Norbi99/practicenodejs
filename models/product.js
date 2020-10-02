const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const productSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    price:{
        type: Number,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    imageUrl: {
        type:String,
        required: true //imageUrl:String, így is lehetett volna, ha nem akarjuk, hogy required legyen
    },
    //create relation
    userId:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

module.exports = mongoose.model('Product',productSchema);