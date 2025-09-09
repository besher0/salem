const express = require('express');
const router = express.Router();

// === Middlewares ===
const multerGlobal = require('../middlewares/multerGlobal');
const isAuth = require('../middlewares/isAuth');

// === Controllers ===

// Auth
const { sendOtp, signup, login, deleteAccount } = require('../controllers/Student/Auth');
const { updateFcmToken } = require('../controllers/Student/FcmToken');

// Codes
const { redeemCode,getCodesInfo } = require('../controllers/Student/Code');

router.get('/redeemCodes', isAuth, getCodesInfo);

// Paid content
const { 
  getAccessibleMaterials,
  getAccessibleQuestions,
  getQuestionGroupWithQuestion,
  getAccessibleCoursesByMaterial,
  getCourseFiles,
  getAccessibleVideosByCourse,
  getExamByMaterial
} = require('../controllers/Student/PaidContent');

// Admin
const { getMaterials } = require('../controllers/Admin/Material');
const { getSections } = require('../controllers/Admin/Section');

// Files & filess
const { getResolutions } = require('../controllers/Student/Files');
const { getfiless } = require('../controllers/Student/Files');

// Profile
const { getProfile, updateProfile } = require('../controllers/Student/Profile');

// Favorites
const { addFavoriteQuestionGroup, removeFavoriteQuestionGroup, getFavoriteQuestionGroups } = require('../controllers/Student/Favorite');

// Notifications
const { getUserNotifications } = require('../controllers/Student/Notification');


// === Routes ===

// Auth
router.post('/otp', sendOtp);
router.post('/signup', signup);
router.post('/login', login);
router.put('/fcmToken', isAuth, updateFcmToken);
router.delete('/deleteAccount', isAuth, deleteAccount);

// Codes
router.post('/redeemCode', isAuth, redeemCode);

const {
  getFreeQuestionsByMaterial,
} = require('../controllers/Student/FreeQuestion');
const {
  getFreeCourses,
} = require('../controllers/Student/FreeCourse');
// Free content
router.get('/freeQuestionsByMaterial', isAuth, getFreeQuestionsByMaterial);
router.get('/freeCourses', isAuth, getFreeCourses);

// Materials
router.get('/materials', isAuth, getMaterials);
router.get('/accessibleMaterials', isAuth, getAccessibleMaterials);

// filess & Files
router.get('/filess/:material', isAuth, getfiless);     // filess
router.get('/files/:material', isAuth, getfiless);        // Alias for filess

// Sections & Sections
router.get('/Sections', multerGlobal, isAuth, getSections);       // Sections
router.get('/sections', multerGlobal, isAuth, getSections);    // Alias for Sections

// Questions
router.get('/questions', isAuth, getAccessibleQuestions);
router.get('/question', isAuth, getQuestionGroupWithQuestion);

// Courses — DISABLED
router.get('/courses', isAuth, getAccessibleCoursesByMaterial);

// Course Files — DISABLED
// router.get('/courseFiles/:course', isAuth, (req, res) => {
//   return res.status(410).json({ success: false, message: 'تم إلغاء ملفات الكورس.' });
// });

// Videos
router.get('/videos', isAuth, getAccessibleVideosByCourse);

// Exams
router.get('/exam/:material', isAuth, getExamByMaterial);

// Resolutions
router.get('/resolutions', getResolutions);

// Profile
router.get('/profile', isAuth, getProfile);
router.put('/profile', isAuth, updateProfile);

// Favorites
router.post('/favorites', isAuth, addFavoriteQuestionGroup);
router.delete('/favorites/:questionGroupId', isAuth, removeFavoriteQuestionGroup);
router.get('/favorites', isAuth, getFavoriteQuestionGroups);

// Notifications
router.get('/notifications', isAuth, getUserNotifications);

const { getVideosByMaterialSection } = require('../controllers/Student/PaidContent');
router.get('/videosBySection', isAuth, getVideosByMaterialSection);

const {getVideos} = require('../controllers/Student/PaidContent');

router.get('/videoss', isAuth, getVideos);


module.exports = router;
