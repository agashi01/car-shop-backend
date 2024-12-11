const stream = require("stream");

const create = (db, cloudinary) => async (req, res) => {
  const { make, model, mileage, color, transmission, fuelType, vehicleType, dealer_id } = req.body;
  // const paths = await db('cars').select('paths')
  // console.log(paths)
  // const publicIds = paths.map(path => {
  //   const paths = path.paths[0]
  //   const ids = paths.map(path => {
  //     const fraction = path.split('/')
  //     const public = fraction[fraction.length - 1]
  //     const id = public.split('.')[0]
  //     return id
  //   })
  //   return ids
  // })
  // const allPublicIds=publicIds.flat()
  //   cloudinary.api.delete_resources(allPublicIds, (delErr, delResult) => {
  //     if (delErr) {
  //       console.error('Error deleting images:', delErr);
  //       return res.status(500).json({ error: 'Error deleting images' });
  //     } else {
  //       console.log('Deleted images:', delResult);
  //     }
  //   });

  const interiorKeywords = [
    "cassette player",
    "tape player",
    "radio",
    "dashboard",
    "car",
    "steering wheel",
    "seats",
  ];
  const interiorCheck = (key) => {
    for (let x of interiorKeywords) {
      if (key.label.includes(x)) {
        if (key.score > 0.08) {
          return true;
        }
      }
    }
    return false;
  };

  let urls = [];
  let images = [];
  if (req.files.length > 15) return res.status(400).json("To many images, the limit is 15");
  try {
    const promises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const uploadCloudinary = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
          },
          (error, result) => {
            if (result) {
              images.push(result);

              urls.push(result.secure_url);

              resolve(result);
            } else {
              if (error.errMessage === "Invalid resource type") {
                reject({
                  message: "Invalid resource type",
                  statusCode: 400,
                  error: "Invalid parameters",
                });
              }
            }
          }
        );
        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);
        bufferStream.pipe(uploadCloudinary);
      });
    });
    await Promise.all(promises);

    // images[x] = await cloudinary.uploader.upload(req.files[x].path).secure_url;
  } catch (err) {
    for (let x = 0; x < images.length; x++) {
      cloudinary.uploader.destroy(images[x].public_id);
    }

    console.log(err, "cloudinary");
    if (
      err.message === "Only image files (JPEG, PNG, jpg) are allowed. Please upload valid images."
    ) {
      return res
        .status(400)
        .json("Only image files (JPEG, PNG, jpg) are allowed. Please upload valid images.");
    } else {
      return res.status(400).json("error");
    }
  }
  let errMessage = "";
  let status = null;
  const fetchAPI = async (x) => {
    return await fetch("https://api-inference.huggingface.co/models/facebook/detr-resnet-50", {
      headers: { Authorization: `Bearer ${process.env.IMAGEAPI}` },
      method: "POST",
      "content-type": "application/json",
      body: urls[x],
    });
  };
  let counter = 0;
  loop1: for (let x = 0; x < urls.length; x++) {
    const response = await fetchAPI(x);
    if (response.ok) {
      const result = await response.json();
      const car = result.some((detection) => detection.label === "car" && detection.score > 0.9);
      const clear = result.some((detection) => detection.label === "car" && detection.score > 0.5);

      if (!car) {
        const responseInterior = await fetch(
          "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.IMAGEAPI}`,
              "Content-Type": "application/json",
            },
            body: urls[x],
          }
        );
        if (responseInterior.ok) {
          const resultInterior = await responseInterior.json();
          let count = 0;
          loop2: for (let key of resultInterior) {
            const isItInterior = interiorCheck(key);
            isItInterior ? count++ : null;

            if (count > 1) {
              continue loop1;
            }
          }
        } else {
          for (let y = 0; y <= x; y++) {
            await cloudinary.uploader.destroy(images[y].public_id);
          }

          const errorText = await responseInterior.text();
          console.log(responseInterior.status, responseInterior.statusText, errorText, "here");
          return res
            .status(responseInterior.status)
            .json("Problems in the server, please try again in a bit ...");
        }

        for (let y = 0; y <= x; y++) {
          cloudinary.uploader.destroy(images[y].public_id);
        }

        if (clear) {
          errMessage = `image number ${x + 1} is not clear. Please retake it!`;
          status = 400;
        } else {
          errMessage = `image number ${x + 1} is not related to a car or is not clear!`;
          status = 400;
        }
      } else {
      }
    } else {
      if (counter++ < 1) {
        await new Promise((resolve) => setTimeout(() => resolve(), 2000));
        continue;
      }
      for (let y = 0; y <= x; y++) {
        try {
          let ans = await cloudinary.uploader.destroy(images[y].public_id);
        } catch (error) {
          console.error(`Error deleting image ${images[y].public_id}:`, error.message);
        }
      }

      const errorText = await response.text();
      console.log(response.status, response.statusText, errorText, "here");
      return res.status(response.status).json("Problems in the server, please try again!");
    }
    if (errMessage) {
      return res.status(status).json(errMessage);
    }
  }

  try {
    // Check if the dealer is valid
    const dealer = await db("users").select("*").where("id", dealer_id).first();
    if (!dealer) {
      return res.status(404).json("You are not a dealer");
    }

    // Start transaction
    await db.transaction(async (trx) => {
      try {
        const [car] = await trx("cars")
          .insert({
            date_of_creation: new Date().toISOString(),
            date_of_last_update: new Date().toISOString(),
            make,
            model,
            mileage,
            color,
            transmission,
            fuel_type: fuelType,
            vehicle_type: vehicleType,
            dealer_id,
            paths: JSON.stringify([urls]),
          })
          .returning("*");

        if (car) {
          res.json("success");
        }

        // Commit the transaction
        await trx.commit();
      } catch (err) {
        await trx.rollback();
        console.error(err);
        res.status(400).json("This car is missing something");

        // Rollback the transaction on error
        await trx.rollback();
      }
    });
  } catch (err) {
    await trx.rollback();
    console.error(err);
    res.status(500).json(err);
  }
};

const sortModel = (list) => {
  let finalCount = 0;
  let finalList = [];
  const audi = [];
  let count1 = 0;
  const bmw = [];
  const bmwList = ["1", "2", "3", "4", "5", "6", "7", "8"];
  let count2 = 0;
  const mercedes = [];
  let count3 = 0;

  for (let x = 0; x < list.length; x++) {
    if (list[x].model[0] === "A") {
      audi[count1++] = list[x].model;
    } else if (bmwList.some((el) => list[x].model.startsWith(el))) {
      bmw[count2++] = list[x].model;
    } else {
      mercedes[count3++] = list[x].model;
    }
  }
  if (audi) {
    for (let x = 0; x < audi.length; x++) {
      let min = 999;
      let index = 0;

      for (let y = x; y < audi.length; y++) {
        let numy = 0;
        if (!Number.isInteger(audi[y])) {
          numy = parseInt(audi[y][1]);
        } else {
          numy = audi[y];
        }
        if (numy <= min) {
          min = numy;
          index = y;
        }
      }
      if (index !== x) {
        let num2 = audi[x];
        audi[x] = audi[index];
        audi[index] = num2;
      }
    }

    finalList[finalCount++] = audi;
  }
  if (bmw) {
    for (let x = 0; x < bmw.length; x++) {
      let min = 999;
      let index = 0;

      for (let y = x; y < bmw.length; y++) {
        let numy = parseInt(bmw[y][0]);

        if (numy <= min) {
          min = numy;
          index = y;
        }
      }
      if (index !== x) {
        let num2 = bmw[x];
        bmw[x] = bmw[index];
        bmw[index] = num2;
      }
    }
    finalList[finalCount++] = bmw;
  }

  if (mercedes) {
    for (let y = 0; y < mercedes.length; y++) {
      let letter = mercedes[y][0];
      switch (letter) {
        case "C":
          if (y != 0) {
            let car = mercedes[0];
            mercedes[0] = mercedes[y];
            mercedes[y] = car;
          }
          break;
        case "S":
          if (y != 2) {
            let car = mercedes[2];
            mercedes[2] = mercedes[y];
            mercedes[y] = car;
          }
          break;
        case "E":
          if (y != 1) {
            let car = mercedes[1];
            mercedes[1] = mercedes[y];
            mercedes[y] = car;
          }
      }
    }
    finalList[finalCount++] = mercedes;
  }
  finalList = finalList.flat();
  const fList = [];
  for (let x = 0; x < finalList.length; x++) {
    let obj = {};
    obj.model = finalList[x];
    obj.checked = false;
    obj.id = x;
    fList[x] = obj;
  }
  return fList;
};

const model = (db) => async (req, res) => {
  const { vehicleList } = req.query;
  const list = [];
  try {
    const models = await func2(db, vehicleList);
    if (models) {
      const finalModels = sortModel(models);
      return res.json(finalModels);
    } else {
      return res.status(400).json("failed");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json(err);
  }
};

const func = async (
  db,
  vehicle,
  model,
  limit,
  offset,
  carsState,
  num = null,
  pageNumber = null,
  id = null,
  dealer = null
) => {
  try {
    let query = db("cars")
      .whereNotNull("paths")
      .join("users", "cars.dealer_id", "users.id")
      .whereIn("make", vehicle || [])
      .whereIn("model", model || []);
    if (carsState) {
      const values = Object.values(carsState);
      const all = values.every((value) => value === false);
      const none = values.every((value) => value === true);
      let isit = false;
      if (!all) {
        if (!none) {
          if (carsState.selling === "true") {
            query.whereRaw("cars.dealer_id=?", [id]);
            isit = true;
          }
          if (carsState.sold === "true") {
            if (isit) {
              query.orWhere(function () {
                this.whereRaw("cars.dealer_id=? and cars.owner_id is not null", [id]);
              });
            } else {
              query.whereRaw("cars.dealer_id=? and cars.owner_id is not null", [id]);
              isit = true;
            }
          }
          if (carsState.owned === "true") {
            if (isit) {
              query.orWhere(function () {
                this.whereRaw("cars.owner_id =?", [id]);
              });
            } else {
              query.whereRaw("cars.owner_id =?", [id]);
              isit = true;
            }
          }
          if (carsState.inStock === "true") {
            if (isit) {
              query.orWhere(function () {
                this.whereRaw("cars.owner_id is null");
              });
            } else {
              query.whereRaw("cars.owner_id is null");
              isit = true;
            }
          }
          if (carsState.outOfStock === "true") {
            if (isit) {
              query.orWhere(function () {
                this.whereRaw(
                  "cars.dealer_id <> ? and cars.owner_id <> ? and cars.owner_id is not null",
                  [id, id]
                );
              });
            } else {
              query.whereRaw(
                "cars.dealer_id <> ? and cars.owner_id <> ? and cars.owner_id is not null",
                [id, id]
              );
            }
          }
        }
      }
    }

    if (dealer === "Selling") {
      query = query.orderByRaw(
        `
          CASE WHEN cars.dealer_id = ? and cars.owner_id IS NULL THEN 0 
           WHEN cars.dealer_id = ? THEN 1
           WHEN cars.owner_id = ? THEN 2
          ELSE 3 
          END,
          date_of_creation DESC,
          date_of_last_update DESC
        `,
        [id, id, id]
      );
    } else if (id) {
      query = query
        .orderByRaw("CASE WHEN cars.owner_id = ? THEN 0 ELSE 1 END", [id])
        .orderBy("date_of_creation", "DESC")
        .orderBy("date_of_last_update", "DESC");
    }

    const cars = await query
      .select("cars.*", "users.name", "users.surname")
      .limit(limit + 1)
      .offset(offset);

    let end = !(cars.length > limit);

    if (!end) {
      cars.pop();
    }

    const ownerIds = cars.map((car) => car.owner_id).filter((id) => id !== null);
    const owners = await db("users").whereIn("id", ownerIds).select("id", "name", "surname");

    const ownerMap = owners.reduce((acc, owner) => {
      acc[owner.id] = `${owner.name} ${owner.surname}`;
      return acc;
    }, {});

    cars.forEach((car) => {
      car.owner = ownerMap[car.owner_id] || null;
    });

    return [end, cars];
  } catch (err) {
    console.error(err);
    throw new Error("An error occurred while fetching the cars");
  }
};

const readAll = (db) => async (req, res) => {
  const {
    dealer,
    vehicle,
    model,
    num,
    id,
    limit,
    pageNumber,
    checkboxStates: carsState,
  } = req.query;
  let pageNum = Number(pageNumber);
  let number = Number(num);
  const offset = (pageNum - 1) * limit;

  try {
    const cars = await func(
      db,
      vehicle,
      model,
      limit,
      offset,
      carsState,
      number,
      pageNum,
      id,
      dealer
    );
    return res.status(200).json(cars);
  } catch (err) {
    console.log(err);
    res.status(400).json("something went wrong");
  }
};

const func2 = async (db, list) => {
  if (list) {
    return await db("cars").select(db.raw("DISTINCT model")).whereIn("make", list);
  }
  return await db("cars").select(db.raw("DISTINCT model"));
};

const readAllGuest = (db) => async (req, res) => {
  const { vehicle, model, limit, pageNumber } = req.query;
  const offset = (pageNumber - 1) * limit;

  try {
    const cars = await func(db, vehicle, model, limit, offset);

    return res.status(200).json(cars);
  } catch (err) {
    console.log(err);
    res.status(400).json("something went wrong");
  }
};

const make = (db) => async (req, res) => {
  try {
    const rows = await db("cars").select(db.raw("DISTINCT make"));
    if (!rows) {
      throw new Error("Something went wrong with selecting makes");
    }
    return res.json(rows);
  } catch (err) {
    console.log(err);

    res.status(400).json(err);
  }
};

const dealerModel = (db) => (req, res) => {
  const { make, reqModel } = req.query;

  let model = db("cars_info").distinct("model");

  if (make) {
    model = model.where("make", make);
  }
  model
    .then((models) => {
      if (models.some((el) => el.model === reqModel)) {
        let obj = {};
        obj.modelValue = reqModel;
        const model = sortModel(models);
        const fModel = [];
        for (let x = 0; x < model.length; x++) {
          fModel[x] = model[x].model;
        }
        obj.models = fModel;
        return res.json(obj);
      }

      const model = sortModel(models);
      const fModel = [];
      for (let x = 0; x < model.length; x++) {
        fModel[x] = model[x].model;
      }
      return res.json(fModel);
    })
    .catch((err) => {
      console.log(err);
      res.status(400).json("something went wrong with the model query");
    });
};

const dealerMake = (db) => (req, res) => {
  const { model, reqMake } = req.query;
  let make = db("cars_info").distinct("make");
  if (model) make = make.where("model", model);
  make
    .then((makes) => {
      if (makes.length) {
        if (makes[0].make === reqMake && model) {
          return res.json(makes[0]);
        }
      }

      return res.json(makes);
    })
    .catch((err) => {
      console.log(err);
      return res.status(400).json("something went wrong with the make query");
    });
};

const transmission = (db) => (req, res) => {
  let transmission = db("cars_info").distinct("transmission");
  transmission.then((transmission) => {
    let fTransmission = [];
    for (let x = 0; x < transmission.length; x++) {
      fTransmission[x] = transmission[x].transmission;
    }
    return res.json(fTransmission);
  });
};

const fuelType = (db) => (req, res) => {
  let fuelType = db("cars_info").distinct("fuel_type");
  fuelType.then((fuelType) => {
    let finalFuelType = [];
    for (let x = 0; x < fuelType.length; x++) {
      finalFuelType[x] = fuelType[x].fuel_type;
    }
    return res.json(finalFuelType);
  });
};

const vehicleType = (db) => (req, res) => {
  let vehicleType = db("cars_info").distinct("vehicle_type");
  vehicleType.then((vehicleType) => {
    let finalVehicleType = [];
    for (let x = 0; x < vehicleType.length; x++) {
      finalVehicleType[x] = vehicleType[x].vehicle_type;
    }
    return res.json(finalVehicleType);
  });
};

const read = (db) => (req, res) => {
  const { id } = req.params;
  const clientId = id;

  db.where({
    id: clientId,
  })
    .select("cars")
    .returning("*")
    .then((car) => {
      res.json(car[0]);
    })
    .catch((err) => {
      console.log(err);
      res.status(404).json("car doesn't exist");
    });
};

const update = (db) => async (req, res) => {
  const { id, carId } = req.body;

  try {
    // Check if a car with carId exists
    const car = await db("cars").select("*").where("id", carId).first();

    if (!car) {
      return res.status(404).json({ id: car.id, error: "Car not found" });
    }

    if (car.owner_id) {
      return res.status(409).json({
        ownerId: car.owner_id,
        id: car.id,
        message: "This car is out of stock",
      });
    }

    // Perform the update
    const result = await db("cars").where("id", carId).update("owner_id", id);

    if (result) {
      return res.status(200).json("success");
    } else {
      return res.status(400).json({ error: "Update failed" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while updating the owner_id" });
  }
};

const delet = (cloudinary, db) => async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(403).json("id is missing");
  }

  const paths = await db("cars").select("paths").where({ id });

  const ids = paths[0].paths[0].map((path) => {
    console.log(path);
    const fraction = path.split("/");
    const public = fraction[fraction.length - 1];
    const id = public.split(".")[0];
    return id;
  });

  cloudinary.api.delete_resources(ids, (delErr, delResult) => {
    if (delErr) {
      console.error("Error deleting images:", delErr);
      return res.status(500).json({ error: "Error deleting images" });
    } else {
      console.log("Deleted images:", delResult);
    }
  });

  db("cars")
    .where({
      id,
    })
    .del()
    .then((car) => {
      return res.json("Car is now deleted");
    })
    .catch((err) => {
      console.log(err);
      res.status(404).json("this car doesnt exist");
    });
};

module.exports = {
  createCar: create,
  readCar: read,
  updateCar: update,
  deleteCar: delet,
  readAll,
  readAllGuest,
  make,
  model,
  dealerModel,
  dealerMake,
  transmission,
  fuelType,
  vehicleType,
};
