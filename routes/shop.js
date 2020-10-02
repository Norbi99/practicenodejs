const path = require('path');

const express = require('express');

const shopController = require('../controllers/shop')
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/',shopController.getIndex);

router.get('/products',shopController.getProducts);

router.get('/products/:productId',shopController.getProduct);
//ha van egy dinamikusan route és egy specifikus, akkor a dinamikus kerüljön mindig alulra,
// különben sosem érné el a specifikusat a node

router.get('/cart',isAuth,shopController.getCart);

router.post('/cart',isAuth,shopController.postCart);
//get requestnél urlbe lehet adatot átadni(pl id-t) ---
//post requestbe input valueba ami van ahhoz hozzáférünk req.body-nál azzal a névvel amit megadtunk input name-nek

router.post('/cart-delete-item',isAuth,shopController.postCartDeleteProduct);

router.post('/create-order',isAuth,shopController.postOrder);

router.get('/orders',isAuth,shopController.getOrders);

router.get('/orders/:orderId',isAuth,shopController.getInvoice);//:orderId mivel ezt adjuk meg linknek orders.ejsben


module.exports = router;
