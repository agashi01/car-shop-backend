const create = (db) => (req, res) => {
  const { name } = req.body;
  if (!name) {
    throw new Error("Name is missing ");
  }

  db("dealers")
    .insert({ date_of_creation: new Date(), date_of_last_update: new Date(), dealer_name: name })
    .returning("*")
    .then((dealer) => {
      db("dealers")
        .where({ id: dealer[0].id })
        .select("*")
        .then((result) => res.json({ dealer: result[0] }));
    })
    .catch((err) => {
      console.log(err);
      res.status(404).json("Wrong credentials");
    });
};

const readAll = (db) => (req, res) => {
  db.select("*")
    .from("dealers")
    .returning("*")
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      res.status(400).json("something went wrong");
    });
};

const read = (db) => (req, res) => {
  const { id: client_id } = req.params;
  db("dealers")
    .where({
      id: client_id,
    })
    .select("*")
    .returning("*")
    .then((dealer) => {
      if (dealer.length > 0) {
        res.json(dealer[0]);
      } else {
        res.status(404).json({ message: "Dealer not found" });
      }
    })
    .catch((err) => {
      res.status(500).json(err.message);
    });
};

const update = (db) => (req, res) => {
  const { id: client_id } = req.params;
  const { dealer_name } = req.body;
  db("dealers")
    .where({
      id: client_id,
    })
    .update({
      dealer_name: dealer_name,
      date_of_last_update: new Date().toISOString(),
    })
    .returning("*")
    .then((user) => {
      res.json(user[0]);
    })
    .catch((err) => {
      res.status(404).json("something went wrong");
    });
};

const delet = (db) => (req, res) => {
  const { id } = req.params;
  db("dealers")
    .where({
      id: id,
    })
    .del()
    .returning("*")
    .then((user) => {
      res.json("dealer is deleted");
    })
    .catch((err) => {
      res.status(404).json("something went wrong");
    });
};

module.exports = {
  createDealer: create,
  readDealer: read,
  updateDealer: update,
  deleteDealer: delet,
  readAll: readAll,
};
