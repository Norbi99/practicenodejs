const mongodb = require('mongodb');
const Product = require('../models/product');

const fileHelper = require('../util/file');

const {validationResult} = require('express-validator/check');

exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: false,
        errorMessage: null,
        validationErrors:[]
    });
};

exports.postAddProduct = (req, res, next) => {
    const title = req.body.title;
    const image = req.file;
    const price = req.body.price;
    const description = req.body.description;
    if(!image){
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            hasError: true,
            editing: false,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: "Attached file is not an image",
            validationErrors: []
        })
    }
    const errors = validationResult(req);//routenál validáltunk,itt kapjuk vissza az eredményét

    if(!errors.isEmpty()){
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            hasError: true,
            editing: false,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array()
        })
    };

    const imageUrl = image.path;

    const product = new Product({
        title: title,
        imageUrl: imageUrl,
        price: price,
        description: description,
        userId: req.user //mongoose will keep just the id
    });
    product
        .save()
        .then(() => {
            console.log('Created a product');
            res.redirect('/admin/products');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
            /**express rögtön az error handling middlewarre megy next(error) esetén*/
        });
};

exports.getEditProduct = (req, res, next) => {
    // /admin/edit-product/{productId}?edit=true
    //query param mindig string, "true", itt a !editmode az azt jelenti, hogy editmode null,azaz nem létezik
    const editMode = req.query.edit;
    if (!editMode) {
        return res.redirect('/');
    }
    const prodId = req.params.productId;
    Product.findById(prodId)
        .then((product) => {
            if (!product) {
                return res.redirect('/');
            }
            res.render('admin/edit-product', {
                pageTitle: 'Edit Product',
                path: '/admin/edit-product',
                editing: editMode,
                product: product,
                hasError: false,
                errorMessage: null,
                validationErrors: []
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postEditProduct = (req, res, next) => {
    const prodId = req.body.productId;//hidden inputként átadjuk ha editing
    const updatedTitle = req.body.title;
    const updatedPrice = req.body.price;
    const image = req.file;
    const updatedDescription = req.body.description;

    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Edit Product',
            path: '/admin/edit-product',
            hasError: true,
            editing: true,
            product: {
                title: updatedTitle,
                price: updatedPrice,
                description: updatedDescription,
                _id:prodId
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array()
        })
    };

    Product.findById(prodId)
        .then(product => {
            if (product.userId.toString() !== req.user._id.toString()) {//levédjük,hogy csak az tudja editelni aki létrehozta(req.user-t app.js-ben beállítjuk)
                return res.redirect('/');
            }
            product.title = updatedTitle;
            product.price = updatedPrice;
            if(image){//ha nem töltött fel képet editelésnél, akkor tartsa meg a régit
                fileHelper.deleteFile(product.imageUrl);
                product.imageUrl = image.path;//ha feltöltött akkor írja ezt át, ha nem töltött akkor nem adunk meg imageUrl mezőt, ezáltal megmarad a régi
            }
            product.description = updatedDescription;
            return product.save().then(() => {
                console.log('Updated product');
                res.redirect('/admin/products');
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.getProducts = (req, res, next) => {
    Product.find({userId: req.user._id}) //app.jsben beállítottuk,ezért elérjük, azért kell hogy csak azokat a productokat lássa a létrehozója amit ő hozott létre
        //.select(title price -_id) // csak title és price visszaadja id viszont nem
        //.populate('userId') //path (lehetne egymásba ágyazott is), populate('userId','name') 2. argumentum olyan mint a select(), azt adja vissza amit oda beírsz
        .then((products) => {
            //populate nélkül products:[{_id:5f7324cda0f42c5045bd5567,title:'asd'...,userId: 5f73220d538fe64fedded509}] userId csak,mivel azt is akarjuk ebben az esetben
            //populattel  products:[{_id:5f7324cda0f42c5045bd5567,title:'asd'...,userId: {_id:5f73220d538fe64fedded509,name:'Max',email:'max@test.com'}}]
            //udemy 219.rész
            //deep populate utánaolvasni(bele lehet teljesen az adatokba menni és lekérni ami kell)
            res.render('admin/products', {
                prods: products,
                pageTitle: 'Admin products',
                path: '/admin/products'
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then(product=>{
            if(!product){
                return next(new Error('Product not found'));
            }
            fileHelper.deleteFile(product.imageUrl);
            return Product.deleteOne({_id:prodId,userId:req.user._id})//levédjük,hogy csak az tudja törölni aki létrehozta(req.user-t app.js-ben beállítjuk)
        })
        .then(() => {
            console.log('Destoryed product');
            res.redirect('/admin/products');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
}