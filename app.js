const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');

const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGODB_URI = "mongodb+srv://maximilian:mQrRjK7cODJJ6ib8@cluster0.ymrtl.mongodb.net/node-complete?retryWrites=true&w=majority";
const app = express();
const store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: 'sessions'
});
const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images'); //null az az hogy nincs error vagyis error=null,tehát adunk engedélyt,hogy tárolja a fájlt,images az a folder neve
    },
    filename: (req, file, cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);//new Date().toISOString() azért kell hogy egyedi neveik legyenek a fileoknak hacsak nem töltenek fel ugyanabban a századmásodpercben egy ugyanolya nevű fájlt🥴, és ha két ugyanolyan nevű képet töltenének fel, akkor se írják felül egymást
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg'){
        cb(null, true); //mehet
    }else{
    cb(null, false); //nem mehet
    }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

app.use(bodyParser.urlencoded({extended: false}));
app.use(multer({storage: fileStorage, fileFilter:fileFilter}).single('image'));//image because the input name is image in edit-product.ejs
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images',express.static(path.join(__dirname, 'images')));
//images-t tekinti root foldernek, ezért a path nem lez jó hogy localhost:3000/images/kepnev,ejsben is kellett / állítani az img srcnél, és itt a middlewarenél is hogy csak a /images utáni urlt nézze(mint a /adminnál)
//olyan fileoknál ez jó megoldás amik mndenki számára elérhetőek kell legyenek(mert ha ezt az bárki urlt beírja, látja a képet
app.use(
    session({
        secret: 'my secret',
        resave: false,
        saveUninitialized: false,
        store: store
    }));
app.use(csrfProtection);//after session!
app.use(flash());//after session! //a kezdetleges error messagesekhez kellett,több sessionön át lehet adni dolgokat, addig benne lesz a sessionbe amíg fel nem használják utána automatikusan eltávolítja belőle a package


app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next();
});//minden responeba(tehát renderbe is) benne lesznek, nem kell mindhez egyesével hozzáadni(de a view-kba hozzá kell adni a formokhoz hidden inputként)
//bejelentkezésnél adjuk hozzá a sessionhöz az isLoggedIn-t, és a req.session.user-t is

app.use((req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    User.findById(req.session.user._id)
        .then(user => {
            if (!user) {//errorokal végignézni az appot, mert ha nem kezeljük az errort, akkor becrashel az app és nem fut le utána semmi, ha kezeljük akkor tovább fut
                /**ASYNC kódnál a throw new Error nem vezet az error middlewarre,nem kezeli express!muszáj next()-et hívni**/
                /**ASYNC:then(),catch(),callbacks**/
                /**SYNC kódnál működik a throw new Error, és megyünk is az error handling middlewarre**/
                /**ASYNC:next(new Error(err)), SYNC:throw new Error(err)**/
                /**Ha a then()-be BÁRMILYEN error van, a catch() mindent elkap, pl: method.then(()=>throw new Error("Dummy error")).catch(err=>next(new Error(err)) ez így működni fog, mivel végtére a catch elkapja, és be fogja hozni az error handling middlewaret**/
                return next();
            }
            req.user = user;
            next();
        })
        .catch(err => {
            return next(new Error(err));
        })
    //azért kell ez mert a db csak az adatokat adja vissza a mongoose metódusokat nem
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);

app.use(errorController.get404);
/**Error handling middleware*/
app.use((error, req, res, next) => {
    //res.status(error.httpStatusCode).render(...);//ha több féle error paget akarunk csinálni status kódok szerint
    //res.redirect('/500');
    /*PAY ATTENTION TO AVOID INFINITE LOOPS TRIGGERED THROUGH ERROR HANDLING MIDDLEWARE*/
    res.status(500).render('500', {
        pageTitle: 'Error!',
        path: '/500',
        isAuthenticated: req.session.isLoggedIn
    });
})

mongoose
    .connect(MONGODB_URI)
    .then(result => {
        console.log("Connected");
        app.listen(3000);
    })
    .catch(err => console.log(err));










