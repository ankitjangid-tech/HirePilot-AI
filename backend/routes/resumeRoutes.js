const express = require("express");
const multer = require("multer");

const router = express.Router();

const verifyToken =
require("../middleware/authMiddleware");

const {
uploadResume
}=require("../controllers/resumeController");

const storage=multer.diskStorage({

destination:(req,file,cb)=>{

cb(null,"./uploads/");

},

filename:(req,file,cb)=>{

cb(
null,
Date.now()+"-"+file.originalname
);

}

});

const upload=multer({

storage:storage

});

router.post(

"/upload",

verifyToken,

upload.single("resume"),

uploadResume

);

module.exports=router;