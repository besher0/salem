const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const {
  signup,
  login,
  deleteAccount,
  sendOtp,
} = require('../controllers/Student/Auth');
const { redeemCode, getCodesInfo } = require('../controllers/Student/Code');
const {
  getFreeQuestionsjByLesson,
  getFreeQuestionsByMaterial,
} = require('../controllers/Student/FreeQuestion');
const {
  getAccessibleMaterials,
  getAccessibleQuestions,
  getAccessibleCoursesByMaterial,
  getAccessibleVideosByCourse,
  getQuestionGroupWithQuestion,
} = require('../controllers/Student/Paid content');
const {
  getFreeCourses,
  getFreeVideos,
} = require('../controllers/Student/FreeCourse');
const { getProfile, updateProfile } = require('../controllers/Student/Profile');
const { getResolutions } = require('../controllers/Student/Files');
const {
  addFavoriteQuestionGroup,
  getFavoriteQuestionGroups,
  removeFavoriteQuestionGroup,
} = require('../controllers/Student/Favorite');
const { updateFcmToken } = require('../controllers/Student/FcmToken');
const { getSellCenters } = require('../controllers/Admin/SellCenter');
const { getMaterials } = require('../controllers/Admin/Material');
const { getUnits } = require('../controllers/Admin/Unit');
const { getLessons } = require('../controllers/Admin/Lesson');
const { getUserNotifications } = require('../controllers/Student/Notification');
const { getLectures } = require('../controllers/Student/Lecture');
router.post('/otp', sendOtp);
router.post('/signup', signup);
router.post('/login', login);
router.put('/fcmToken', isAuth, updateFcmToken);
router.delete('/deleteAccount', isAuth, deleteAccount);

router.post('/redeemCode', isAuth, redeemCode);

router.get('/freeQuestions', isAuth, getFreeQuestionsjByLesson);
router.get('/freeQuestionsByMaterial', isAuth, getFreeQuestionsByMaterial);
router.get('/freeCourses', isAuth, getFreeCourses),
  router.get('/freeVideos', isAuth, getFreeVideos);

router.get('/materials', isAuth, getMaterials);
router.get('/accessibleMaterials', isAuth, getAccessibleMaterials);
router.get('/lectures/:material', isAuth, getLectures);
router.get('/units', multerGlobal, isAuth, getUnits);
router.get('/lessons', multerGlobal, isAuth, getLessons);
router.get('/questions', isAuth, getAccessibleQuestions);
router.get('/question', isAuth, getQuestionGroupWithQuestion);
router.get('/courses', isAuth, getAccessibleCoursesByMaterial);
router.get('/videos', isAuth, getAccessibleVideosByCourse);
router.get('/resolutions', getResolutions);

router.get('/profile', isAuth, getProfile);
router.put('/profile', isAuth, updateProfile);

router.post('/favorites', isAuth, addFavoriteQuestionGroup);
router.delete(
  '/favorites/:questionGroupId',
  isAuth,
  removeFavoriteQuestionGroup
);
router.get('/favorites', isAuth, getFavoriteQuestionGroups);

router.get('/sellCenters', isAuth, getSellCenters);

router.get('/redeemCodes', isAuth, getCodesInfo);

router.get('/notifications', isAuth, getUserNotifications);

module.exports = router;
