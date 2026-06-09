let express = require('express');
let fs = require('fs');
let path = require('path');
let app = express();
const bcrypt = require('bcryptjs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const employeeFilePath = path.join(__dirname, 'employees.json');
const loginFilePath = path.join(__dirname, 'logins.json');

// Admin code required to register. Configure via env var `ADMIN_CODE`.
const ADMIN_CODE = process.env.ADMIN_CODE || 'letmein123';

const defaultEmployees = [
    { id: 1, name: 'John', age: 30, position: 'Software Engineer' },
    { id: 2, name: 'Jane', age: 28, position: 'Product Manager' }
];

function readJsonArray(filePath, fallbackValue) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8').trim();
        if (!fileContent) {
            return fallbackValue;
        }

        const parsedContent = JSON.parse(fileContent);
        return Array.isArray(parsedContent) ? parsedContent : fallbackValue;
    } catch (error) {
        return fallbackValue;
    }
}

function writeJsonArray(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

//JavaScript object in literal format

// let employee1 = {
//     id: 1,
//     name: 'John',
//     age: 30,
//     position: 'Software Engineer'
// };

// let employee2 = {
//     id: 2,
//     name: 'Jane',
//     age: 28,
//     position: 'Product Manager'
// };

// let employees = [employee1, employee2];

// http://localhost:3000/
app.get('/', (req, res) => {
    res.render("login");
});

// http://localhost:3000/signUpPage
app.get("/signUpPage", (req, res) => {
    let msg="";
    res.render("signUp",{msg});
});

// http://localhost:3000/signIn
app.post("/signIn", (req, res) => {
    let msg="";
    let login = req.body;
    let loginFs = readJsonArray(loginFilePath, []);
    const stored = loginFs.find(l => l.emailID === login.emailID);
    let passwordMatches = false;
    if (stored) {
        try {
            passwordMatches = bcrypt.compareSync(login.password, stored.password);
        } catch (e) {
            // fallback if stored.password is plain text
            passwordMatches = stored.password === login.password;
        }
    }

    if (stored && passwordMatches) {
        let emailID = stored.emailID;
        // If the stored password was plaintext and matched, upgrade it to a hashed password
        if (stored.password === login.password) {
            try {
                const newHash = bcrypt.hashSync(login.password, 10);
                stored.password = newHash;
                writeJsonArray(loginFilePath, loginFs);
            } catch (e) {
                // ignore upgrade errors
            }
        }
        msg = "Login successful. Welcome, " + emailID + "!";
        res.render("dashboard",{msg, emailID});
    } else {
        msg = "Invalid email ID or password.";
        res.render("login",{msg});
    }
});

// http://localhost:3000/signUp
app.post("/signUp", (req, res) => {
    let msg="";
    const { emailID, password, confirmPassword, adminCode } = req.body || {};

    if (!emailID || !password) {
        msg = 'Email ID and password are required.';
        return res.render('signUp', { msg });
    }

    if (password !== confirmPassword) {
        msg = 'Passwords do not match.';
        return res.render('signUp', { msg });
    }

    if (adminCode !== ADMIN_CODE) {
        msg = 'Invalid admin code.';
        return res.render('signUp', { msg });
    }

    let loginFs = readJsonArray(loginFilePath, []);
    let loginExists = loginFs.find(l => l.emailID === emailID);
    if (loginExists) {
        msg = 'Email ID already exists. Please use a different email ID.';
        return res.render('signUp', { msg });
    }

    // Hash the password before storing
    const hashed = bcrypt.hashSync(password, 10);
    // Only store the minimal user record with hashed password
    loginFs.push({ emailID, password: hashed });
    writeJsonArray(loginFilePath, loginFs);
    msg = 'Sign up successful. Please sign in.';
    res.render('login', { msg });
});

// http://localhost:3000/api/employees
app.get('/api/employees', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    res.json(employees);
});

// search employee by id with query parameter
// http://localhost:3000/api/findEmployeeByIdUsingQuery?id=1
app.get('/api/findEmployeeByIdUsingQuery', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    let id = parseInt(req.query.id);
    let employee = employees.find(emp => emp.id === id);
    if (employee) {
        res.json(employee);
    } else {
        res.status(404).json({ message: 'Employee not found' });
    }
});

// search employee by id with path parameter
// http://localhost:3000/api/findEmployeeByIdUsingPath/2
app.get('/api/findEmployeeByIdUsingPath/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    let id = parseInt(req.params.id);
    let employee = employees.find(emp => emp.id === id);
    if (employee) {
        res.json(employee);
    } else {
        res.status(404).json({ message: 'Employee not found' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});