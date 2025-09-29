const express = require('express');
const router = express.Router();

// === Middlewares ===
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');

// === Controllers ===
// Auth
const { createAdmin, login, updatePassword } = require('../controllers/Admin/Auth');

// Material
const { createMaterial, getMaterials, deleteMaterial, updateMaterial } = require('../controllers/Admin/Material');

// Teacher
const { createTeacher, getTeachers, deleteTeacher } = require('../controllers/Admin/Teacher');

const { createCourse, getCourses, deleteCourse, updateCourse } = require('../controllers/Admin/Course');

// Video
const { createVideo, getVideos, deleteVideo, updateVideo } = require('../controllers/Admin/Video');

// Codes Group
const {
  createCodesGroup,
  getCodesGroups,
  deleteCodesGroup,
  getCodesFromGroup,
  exportCodesPDF,
  exportCodeCardsPDF,
} = require('../controllers/Admin/CodesGroup');
const { generateCodes } = require('../controllers/Admin/GenerateCodes');

// Questions & Groups
const { copyQuestionsToFree } = require('../controllers/Admin/FreeQuestion');
const {
  createQuestionGroup,
  getQuestionGroups,
  deleteQuestionGroup,
  deleteQuestion,
  updateQuestion,
  updateQuestionGroup,
} = require('../controllers/Admin/Question');

// Uploads
const { uploadVideo, addVideo } = require('../controllers/Admin/UploadVideo');
const BunnyVideoUploader = require('../middlewares/BunnyVideoUpload');
const { uploadImage } = require('../controllers/Admin/UploadImage');
const BunnyImageUploader = require('../middlewares/BunnyImageUpload');

// Statistics
const { getTeachersStatistics } = require('../controllers/Admin/Statistics');

// Notifications
const { sendNotificationToAllStudents } = require('../controllers/Admin/Notification');
const { getUserNotifications } = require('../controllers/Student/Notification');

// Sell Center
const { createSellCenter, deleteSellCenter, updateSellCenter } = require('../controllers/Admin/SellCenter');

// Section (we will alias as Section)
const { createSection, getSections, deleteSection, updateSection } = require('../controllers/Admin/Section');


// Student
const { getStudents, blockStudent, checkBlockedStatus } = require('../controllers/Admin/Student');

// files (we will alias as File)
const { createfiles, updatefiles, deletefiles, getfilessByMaterial } = require('../controllers/Admin/files');

// ========== Routes ==========

// Uploads
router.post('/addVideo', addVideo);
router.post('/uploadImage', BunnyImageUploader, uploadImage);

// Auth
router.post('/admin', isAuth, multerGlobal, createAdmin);
router.post('/login', multerGlobal, login);
router.post('/updatePassword', isAuth, multerGlobal, updatePassword);

// Students & Blocking
router.get('/students', multerGlobal, isAuth, getStudents);
router.put('/toggleBlock/:id', multerGlobal, isAuth, blockStudent);
router.get('/checkBlock/:id', multerGlobal, isAuth, checkBlockedStatus);

// Material
router.post('/material', multerGlobal, isAuth, createMaterial);
router.put('/material/:id', multerGlobal, isAuth, updateMaterial);
router.delete('/material/:id', multerGlobal, isAuth, deleteMaterial);

// files (original) — kept for backward compatibility
router.post('/files', multerGlobal, isAuth, createfiles);
router.get('/filess/:materialId', multerGlobal, isAuth, getfilessByMaterial);
router.put('/files/:id', multerGlobal, isAuth, updatefiles);
router.delete('/files/:id', multerGlobal, isAuth, deletefiles);

// File (NEW alias replacing 'files')
// router.post('/file', multerGlobal, isAuth, createfiles);
// router.get('/files/:materialId', multerGlobal, isAuth, getfilessByMaterial);
// router.put('/file/:id', multerGlobal, isAuth, updatefiles);
// router.delete('/file/:id', multerGlobal, isAuth, deletefiles);

// Section (original)
// router.post('/Section', multerGlobal, isAuth, createSection);
router.put('/Section/:id', multerGlobal, isAuth, updateSection);
router.delete('/Section/:id', multerGlobal, isAuth, deleteSection);

// Section (NEW alias replacing 'Section')
router.post('/section', multerGlobal, isAuth, createSection);
router.get('/Sections', multerGlobal, isAuth, getSections);
// router.put('/section/:id', multerGlobal, isAuth, updateSection);
// router.delete('/section/:id', multerGlobal, isAuth, deleteSection);

;

// Questions & Groups
router.post('/questions', multerGlobal, isAuth, createQuestionGroup);
router.get('/questions', multerGlobal, isAuth, getQuestionGroups);
router.put('/question/:id', multerGlobal, isAuth, updateQuestionGroup);
router.delete('/question/:id', multerGlobal, isAuth, deleteQuestionGroup);
router.delete('/question/:questionGroupId/:questionIndex', multerGlobal, isAuth, deleteQuestion);
router.put('/question/:questionGroupId/:questionIndex', multerGlobal, isAuth, updateQuestion);

// Teachers
router.post('/teacher', multerGlobal, isAuth, createTeacher);
router.get('/teachers', multerGlobal, isAuth, getTeachers);
router.delete('/teacher/:id', multerGlobal, isAuth, deleteTeacher);

router.post('/course', multerGlobal, isAuth,createCourse);
router.get('/courses', multerGlobal, isAuth,getCourses );
router.put('/course/:id', multerGlobal, isAuth, updateCourse);
router.delete('/course/:id', multerGlobal, isAuth,deleteCourse );



// Videos
router.post('/video', multerGlobal, isAuth, createVideo);
router.get('/videos', multerGlobal, isAuth, getVideos);
router.put('/video/:id', multerGlobal, isAuth, updateVideo);
router.delete('/video/:id', multerGlobal, isAuth, deleteVideo);
const {reorderVideos,updateVideoFreeStatus} = require('../controllers/Admin/Video');

router.post('/updateVideoFreeStatus', isAuth, updateVideoFreeStatus);
router.post('/reorderVideos', isAuth, reorderVideos);

// Codes Group (kept as-is; semantics adjusted in controllers)
router.post('/codesGroup', multerGlobal, isAuth, createCodesGroup);
router.get('/codesGroups', multerGlobal, isAuth, getCodesGroups);
router.get('/codes/:id', multerGlobal, isAuth, getCodesFromGroup);
router.delete('/codesGroup/:id', multerGlobal, isAuth, deleteCodesGroup);
router.post('/generateCodes', multerGlobal, isAuth, generateCodes);
// NOTE: preserved original export path to avoid breaking clients
router.get('/codesGroup/:id/export-pdf', multerGlobal, exportCodeCardsPDF);

// Free Questions toggle
router.post('/changeFreeQuestions', multerGlobal, isAuth, copyQuestionsToFree);

// Stats
router.get('/teachersStatistics', multerGlobal, isAuth, getTeachersStatistics);

// Notifications
router.post('/sendNotification', isAuth, sendNotificationToAllStudents);
router.get('/notifications', isAuth, getUserNotifications);

// Sell Center
router.post('/sellCenter', isAuth, createSellCenter);
router.put('/sellCenter/:id', isAuth, updateSellCenter);
router.delete('/sellCenter/:id', isAuth, deleteSellCenter);

module.exports = router;
