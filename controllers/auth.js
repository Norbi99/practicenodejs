const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const {validationResult} = require('express-validator/check');

const User = require('../models/user');

const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: "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"
    }
}));

exports.getLogin = (req, res, next) => {
    //flash beleteszi a sessionbe az errort és amikor felhasználjuk, törli is
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: message, //pull out the key,itt error nevű
        oldInput:{
            email:'',
            password:''
        },
        validationErrors: []
    });
};

exports.getSignup = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Signup',
        errorMessage: message,
        oldInput: {
            email:"",
            password: "",
            confirmPassword: ""
        },
        validationErrors: []
    });
};

exports.postLogin = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    const errors = validationResult(req);
    if (!errors.isEmpty()){
        console.log(errors.array())
        return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email:email,
                password:password
            },
            validationErrors: errors.array()
        });
    }
    User.findOne({email: email})
        .then(user => {
            /**didnt find with this email**/
            if (!user) {
                return res.status(422).render('auth/login', {
                    path: '/login',
                    pageTitle: 'Login',
                    errorMessage: 'Invalid email or password',
                    oldInput: {
                        email:email,
                        password:password
                    },
                    validationErrors: []
                });
            }
            /**find with this email, now check pw**/
            bcrypt.compare(password, user.password)
                .then(doMatch => {
                    /**correct pw - true**/
                    if (doMatch) {
                        req.session.isLoggedIn = true;
                        req.session.user = user;
                        return req.session.save(err => {
                            console.log(err);
                            return res.redirect('/');
                        });
                    }
                    /**incorrect pw - false**/
                    return res.status(422).render('auth/login', {
                        path: '/login',
                        pageTitle: 'Login',
                        errorMessage: errors.array()[0].msg,
                        oldInput: {
                            email:email,
                            password:password
                        },
                        validationErrors: []
                    });
                })
                .catch(err => {
                    console.log(err);
                    res.redirect('/login');
                })

        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postSignup = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    const errors = validationResult(req);//route/auth.jsben határozzuk meg,onnan adja át
    if (!errors.isEmpty()) {
        console.log("Validation errors:",errors.array());
        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email:email,
                password:password,
                confirmPassword:req.body.confirmPassword
            },
            validationErrors: errors.array()
        });
    }
    bcrypt
        .hash(password, 12)
        .then(hashedPassword => {
            const user = new User({
                email: email,
                password: hashedPassword,
                cart: {items: []}
            });
            return user.save();
        })
        .then(result => {
            res.redirect('/login');
            return transporter.sendMail({
                to: email,
                from: "nagy.norbert@rufftech.hu",//kellene csinálni sender profilet és menne
                subject: "Signup succeeded",
                html: '<h1>You successfully signed up!</h1>'
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postLogout = (req, res, next) => {
    req.session.destroy(err => {
        console.log(err);
        res.redirect('/');
    });
};

exports.getReset = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset password',
        errorMessage: message
    });
};

exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            console.log(err);
            return res.redirect('/reset');
        }
        const token = buffer.toString('hex');
        User.findOne({email: req.body.email})
            .then(user => {
                if (!user) {
                    req.flash('error', 'No account with that email found');
                    return res.redirect('/reset');
                }
                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000//mostani dátum +1 óra
                return user.save();
            })
            .then(() => {
                res.redirect('/');
                return transporter.sendMail({
                    to: req.body.email,
                    from: "nagy.norbert@rufftech.hu",//sender profilet kellett csinálni sendgriden
                    subject: "Password reset",
                    html: `
                    <p>You requested a password reset</p>
                    <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password</p>
                    `
                });
            })
            .catch(err => {
                const error = new Error(err);
                error.httpStatusCode = 500;
                return next(error);
            })
    })
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token; //routenál ezt adtuk meg /reset/:token
    User.findOne({resetToken: token, resetTokenExpiration: {$gt: Date.now()}})//$gt=greater than
        .then(user => {
            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'New password',
                errorMessage: message,
                userId: user._id.toString(),//azért hogy postnál tudjuk küldeni
                passwordToken: token
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
};

exports.postNewPassword = (req, res, next) => {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    let resetUser;

    User.findOne({
        resetToken: passwordToken,
        resetTokenExpiration: {$gt: Date.now()},
        _id: userId
    })
        .then(user => {
            resetUser = user;
            return bcrypt.hash(newPassword, 12);
        })
        .then(hashedPassword => {
            resetUser.password = hashedPassword;
            resetUser.resetToken = null;
            resetUser.resetTokenExpiration = undefined;
            return resetUser.save();
        })
        .then(() => {
            res.redirect('/login');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })

};
