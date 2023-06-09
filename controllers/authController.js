const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/user');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('../utils/appError');

//*MIDLEWARE
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) return next(new AppError('Будь ласка, спочатку авторизуйтеся'), 401);

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_KEY);
  const user = await User.findById(decoded.id);

  if (!user) return next(new AppError('Такого користувача не знайдено', 404));

  req.user = user;
  res.locals.user = user;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(new AppError('Вам не надано прав на цю дію', 403));

    next();
  };
};

//*Only for rendered pages
exports.checkLoggedUser = async (req, res, next) => {
  try {
    let token;

    if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) return next();

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_KEY);
    const user = await User.findById(decoded.id);

    if (!user) return next();

    res.locals.user = user;
    next();
  } catch (err) {
    next();
  }
};

exports.restrictToLogged = (req, res, next) => {
  if (req.cookies.jwt) return next(new AppError('Ви вже авторизовані', 403));

  next();
};
//*

const createToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const sendToken = (user, statusCode, res) => {
  const token = createToken(user.id);
  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  if (process.env.ENV_MODE === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const item = await User.create(req.body);

  sendToken(item, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) return next(new AppError("Електрона пошта та пароль обов'язкові", 400));

  const item = await User.findOne({ email }).select('+password');
  if (!item) return next(new AppError('Такого користувача не знайдено', 404));

  const check = await item.checkPassword(password, item.password);
  if (!check) return next(new AppError('Неправильний пароль', 401));

  sendToken(item, 200, res);
});

exports.logout = catchAsync(async (req, res, next) => {
  res.cookie('jwt', 'logged_out', {
    expires: new Date(Date.now() + 10 * 10),
    httpOnly: true,
  });

  res.status(200).json({
    status: 'success',
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const item = await User.findById(req.user.id).select('+password');
  if (!(await item.checkPassword(req.body.curr_password, item.password)))
    return next(new AppError('Неправильний пароль', 401));

  item.password = req.body.password;
  item.password_confirm = req.body.password_confirm;
  await item.save();

  sendToken(item, 200, res);
});

exports.deleteCurrUser = catchAsync(async (req, res, next) => {
  const item = await User.findByIdAndDelete(req.params.id);

  if (!item) next(new AppError('Не знайдено', 404));

  res.cookie('jwt', 'logged_out', {
    expires: new Date(Date.now() + 10 * 10),
    httpOnly: true,
  });

  res.status(204).json({
    status: 'success',
  });
});
