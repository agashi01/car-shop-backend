const cars = require("./cars");
const dealers = require("./dealers");
const path = require("path");
const runOnce = require("./RunOnce");

const makeApp = (express, app, multer, cloudinary, db, authenticate) => {
  // const storage = multer.diskStorage({
  //   destination: function (req, file, cb) {
  //     return cb(null, path.join(__dirname, "../public/cars"));
  //   },
  //   filename: function (req, file, cb) {
  //     return cb(null, `${Date.now()}_${file.originalname}`);
  //   }
  // });

  // const upload = multer({ storage: storage })

  const storage = multer.memoryStorage();

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const fileTypes = /jpeg|png|jpg|svg|webp|bmp|tiff|tif|svg|jfif/;
      const mimeType = fileTypes.test(file.mimetype);
      const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
      if (mimeType && extName) {
        return cb(null, true);
      } else {
        return cb(
          new Error(
            "Only image files (JPEG, PNG, JPG, SVG, WEBP, JFIF) are allowed. Please upload valid images."
          )
        );
      }
    },
  });

  app.use(authenticate);

  app.get("/", (req, res) => {
    return res.status(200).json("Server is up and running!");
  });

  // app.get("/runOnce", runOnce.runOnce(db));

  app.get("/hey", (req, res) => res.json("hey"));
  app.get("/transmission", (req, res) => cars.transmission(db)(req, res));
  app.get("/fuelType", (req, res) => cars.fuelType(db)(req, res));
  app.get("/vehicleType", (req, res) => cars.vehicleType(db)(req, res));
  app.get("/dealerModel", (req, res) => cars.dealerModel(db)(req, res));
  app.get("/dealerMake", (req, res) => cars.dealerMake(db)(req, res));
  app.get("/model", (req, res) => cars.model(db)(req, res));
  app.post("/cars", upload.array("files", 50), (req, res) => {
    if (!req.files) {
      return res.status(400).json("Please ensure you select and upload images of your car.");
    }
    cars.createCar(db, cloudinary)(req, res);
  });

  app.get("/make", (req, res) => cars.make(db)(req, res));
  app.get("/cars/guest", (req, res) => cars.readAllGuest(db)(req, res));
  app.get("/cars", (req, res) => cars.readAll(db)(req, res));
  app.get("/cars/:id", (req, res) => cars.readCar(db)(req, res));
  app.put("/cars", (req, res) => cars.updateCar(db)(req, res));
  app.delete("/cars", (req, res) => cars.deleteCar(cloudinary,db)(req, res));
  app.post("/dealers", (req, res) => dealers.createDealer(db)(req, res));
  app.get("/dealers", (req, res) => dealers.readAll(db)(req, res));
  app.get("/dealers/:id", (req, res) => dealers.readDealer(db)(req, res));
  app.put("/dealers/:id", (req, res) => dealers.updateDealer(db)(req, res));
  app.delete("/dealers/:id", (req, res) => dealers.deleteDealer(db)(req, res));

  app.use("/static", express.static(path.join(__dirname, "../public")));

  app.use((err, req, res, next) => {
    if (
      err.message === "Only image files (JPEG, PNG, jpg) are allowed. Please upload valid images."
    ) {
      return res
        .status(400)
        .json("Only image files (JPEG, PNG, jpg) are allowed. Please upload valid images.");
    }
    const errStatus = err.statusCode || 500;
    const errMsg = err.message || "Something went wrong";
    return res.status(errStatus).json({
      success: false,
      status: errStatus,
      message: errMsg,
      stack: process.env.NODE_ENV === "development" ? err.stack : {},
    });
  });
};

module.exports = {
  makeApp,
};
