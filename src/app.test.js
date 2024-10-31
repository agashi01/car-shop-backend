const request = require('supertest')
const app = require('./app.js')
const appAuth = require('appAuth.js')

describe('this is a test for the app.js', async () => {
    describe('this is a test for cars', () => {
        test('this test is going to give as a speicific cars based on its id', () => {
            const token = request(appAuth)
                .post('/log-in')
                .set('guest', `Bearer ${token}`)
                .send({ email: 'babaiktu@', password: 'babaiktu' })

            const response = request(app).get('/cars/19688').set
        })
    })

})