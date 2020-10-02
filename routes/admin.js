const path = require('path');

const express = require('express');
const {body} = require('express-validator/check');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// /admin/add-product => GET
//akármennyire middlewaret be lehet tenni és balról jobbra hajtja végre őket
router.get('/add-product', isAuth, adminController.getAddProduct);

// /admin/products => GET
router.get('/products', isAuth, adminController.getProducts);

// /admin/add-product => POST
router.post('/add-product', [
    body('title',"Title is not correct").isString().isLength({min: 3}).trim(),
    body('price',"Price is not correct").isFloat(),
    body('description',"Description is not correct").isLength({min: 5 , max: 400}).trim(),
], isAuth, adminController.postAddProduct);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post('/edit-product',[
    body('title',"Title is not correct").isString().isLength({min: 3}).trim(),
    body('price',"Price is not correct").isFloat(),
    body('description',"Description is not correct").isLength({min: 5 , max: 400}).trim(),
], isAuth, adminController.postEditProduct);

router.post('/delete-product', isAuth, adminController.postDeleteProduct);

module.exports = router;
