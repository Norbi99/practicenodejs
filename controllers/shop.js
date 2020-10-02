const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 1;


exports.getProducts = (req, res, next) => {
    const page = +req.query.page || 1; //ha req.query.page undefined(mint alap esetben amikor csak url/ van, akkor az 1-est használja (//pagination,index.ejsben ezt adtuk meg)
    let totalItems;

    Product
        .find()
        .countDocuments()
        .then(numProducts => {
            totalItems = numProducts;
            return Product
                .find() //find() would retrieve all product
                .skip((page - 1) * ITEMS_PER_PAGE) /**adding pagination**/
                .limit(ITEMS_PER_PAGE)
        })
        .then(products => {
            res.render('shop/product-list', {
                prods: products,
                pageTitle: 'Products',
                path: '/products',
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems/ ITEMS_PER_PAGE)//felfele kerekít,pl ha totalItems=11 itemsperpage=2,11/2=5.5 ->6 oldal van 2-2-2-2-2-2
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getProduct = (req, res, next) => {
    const prodId = req.params.productId;//productId mert a route.jsben /:productId adtunk meg
    Product.findById(prodId)
        .then(product => {
            res.render('shop/product-detail', {
                product: product,
                pageTitle: product.title,
                path: '/products'
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getIndex = (req, res, next) => {
    const page = +req.query.page || 1; //ha req.query.page undefined(mint alap esetben amikor csak url/ van, akkor az 1-est használja (//pagination,index.ejsben ezt adtuk meg)
    let totalItems;

    Product
        .find()
        .countDocuments()
        .then(numProducts => {
            totalItems = numProducts;
            return Product
                .find() //find() would retrieve all product
                .skip((page - 1) * ITEMS_PER_PAGE) /**adding pagination**/
                .limit(ITEMS_PER_PAGE)
        })
        .then(products => {
            res.render('shop/index', {
                prods: products,
                pageTitle: 'Shop',
                path: '/',
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems/ ITEMS_PER_PAGE)//felfele kerekít,pl ha totalItems=11 itemsperpage=2,11/2=5.5 ->6 oldal van 2-2-2-2-2-2
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getCart = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .execPopulate() //needed to have a promise which we can call then()
        .then(user => {
            //console.log(user.cart.items); // array amibe benne vannak a cart itemek részletekkel együtt
            const products = user.cart.items;
            res.render('shop/cart', {
                path: '/cart',
                pageTitle: 'Your Cart',
                products: products
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

//check if the product is existing already in the cart, if it is, we increase quantity,otherwise add it to the cart
exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId) //retrieve single product
        .then(product => {
            return req.user.addToCart(product);
        })
        .then(result => {
            res.redirect('/cart');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.postOrder = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .execPopulate()
        .then(user => {
            console.log(user.cart.items);
            const products = user.cart.items.map(i => {
                return {quantity: i.quantity, product: {...i.productId._doc}};
            });
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user //mongoose will pick the id
                },
                products: products
            });
            order.save();
        })
        .then(() => {
            return req.user.clearCart();
        })
        .then(() => {
            res.redirect('/orders');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.getOrders = (req, res, next) => {
    Order.find({"user.userId": req.user._id})
        .then(orders => {
            res.render('shop/orders', {
                path: '/orders',
                pageTitle: 'Your Orders',
                orders: orders
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    req.user
        .removeFromCart(prodId)
        .then(result => {
            res.redirect('/cart');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getInvoice = (req, res, next) => {
    const orderId = req.params.orderId; //routenál ezt adtuk meg, getnél urlbe adunk, postnál req.bodyba adatot
    Order.findById(orderId)
        .then(order => {
            if (!order) {
                return next(new Error('No order found.'));
            }
            if (order.user.userId.toString() !== req.user._id.toString()) {//csak az láthassa aki csinálta, ne minden bejelentkezett user ezen az url-en(isAuth-tal csak azt csekkoljuk,hogy bejelentkezett e)
                return next(new Error('Unauthorized.'));
            }
            const invoiceName = 'invoice-' + orderId + '.pdf';
            const invoicePath = path.join('data', 'invoices', invoiceName);

            const pdfDoc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"')
            pdfDoc.pipe(fs.createWriteStream(invoicePath));//streameljük a filesystembe
            pdfDoc.pipe(res); //streameljük a clientnek

            pdfDoc.fontSize(26).text('Invoice');
            pdfDoc.fontSize(20).text('------');
            let totalPrice = 0;
            order.products.forEach(prod => {
                totalPrice = totalPrice + prod.quantity * prod.product.price;
                pdfDoc.fontSize(14).text(prod.product.title + ' - ' + prod.quantity + ' x ' + '$' + prod.product.price);
            });
            pdfDoc.fontSize(20).text('------')
            pdfDoc.fontSize(20).text('Total price: $' + totalPrice);
            pdfDoc.end();
            //kis fájloknál ez jó megoldás, mert a szerver először beolvassa a memóriába és úgy adja vissza, de ha sok request jön és nagyok a fájlok, akkor megtelhet a memória
            // fs.readFile(invoicePath, (err, data) => {
            //     if (err) {
            //         return next(err);//error handling middleware comes into play
            //     }
            //     res.setHeader('Content-Type', 'application/pdf');
            //     res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"')//inline lehetne attachment is, akkor letöltené, inlinenál megnyitja
            //     res.send(data);
            // });
            //ha streamelve olvassuk be akkor nem kell előre beolvasnia a fájlt memóriába, hanem chunkokba olvassa be és adja át a böngészőnek
            // const file = fs.createReadStream(invoicePath);
            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"')//inline lehetne attachment is, akkor letöltené, inlinenál megnyitja
            // file.pipe(res);
        })
        .catch(err => next(err))
}

