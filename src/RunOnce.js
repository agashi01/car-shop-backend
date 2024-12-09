const runOnce = (db) => (req, res) => {

  const brand = ["Audi", "Bmw", "Mercedes-Benz"];
  const brandModel = {
    [brand[0]]: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"],
    [brand[1]]: ["1-series", "2-series", "3-series", "4-series", "5-series", "6-series", "7-series", "8-series"],
    [brand[2]]: ["C-class", "E-class", "S-class"],
  };

  const color = ["red", "black", "white"];
  const transmission = ["manual_gearbox", " semi_automatic", "automatic_transmission"];
  const fuel_type = ["petrol", "diesel"];
  const vehicle_type = ["sUV", "cabriolet", "coupe"];

  const createCar = async (
    brand,
    brandModel,
    transmission,
    fuel_type,
    vehicle_type,
  ) => {
    const trx = await db.transaction();

    try {
      await trx("cars_info")
        .insert({
          make: brand,
          model: brandModel,
          transmission: transmission,
          fuel_type: fuel_type,
          vehicle_type: vehicle_type,
        })
        .returning("*")
        .then((res) => {
        });
      await trx.commit();
    } catch (err) {
      console.log(err);
      await trx.rollback();
    }
  };

  const dealer = () => {
    let num = Math.floor(Math.random() * 7);
    return num;
  };

  for (let a = 0; a < brand.length; a++) {
    for (let j = 0; j < brandModel[brand[a]].length; j++) {
      for (let d = 0; d < transmission.length; d++) {
        for (let e = 0; e < fuel_type.length; e++) {
          for (let f = 0; f < vehicle_type.length; f++) {
            createCar(
              brand[a],
              brandModel[brand[a]][j],
              transmission[d],
              fuel_type[e],
              vehicle_type[f],
            );
          }
        }
      }
    }
  }


  res.status(200).json("completed");
};

module.exports = {
  runOnce,
};
