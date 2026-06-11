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
    { id: 1, name: 'Doe, John', designation: 'Software Engineer', email: 'john.doe@example.com', contact: '123-456-7890', department: 'Engineering', joiningDate: '2020-01-15', location: 'New York' },
    { id: 2, name: 'Smith, Jane', designation: 'Product Manager', email: 'jane.smith@example.com', contact: '987-654-3210', department: 'Marketing', joiningDate: '2020-02-01', location: 'Los Angeles' }
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

// http://localhost:3000/
app.get('/', (req, res) => {
    res.render("login");
});

// http://localhost:3000/signUp
app.get("/signUp", (req, res) => {
    let msg = "";
    res.render("signUp", { msg });
});

// Backward-compatible alias for the old signup page route
app.get("/signUpPage", (req, res) => {
    res.redirect("/signUp");
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
        const employees = readJsonArray(employeeFilePath, defaultEmployees);
        res.render("dashboard", {
            msg,
            emailID,
            employees: sortEmployees(employees, 'id', 'asc'),
            currentSort: 'id',
            currentOrder: 'asc',
            filters: { search: '', designation: '', department: '', location: '' }
        });
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

// search employee by id with query parameter
// http://localhost:3000/api/findEmployeeByIdUsingQuery
app.get('/api/findEmployeeByIdUsingQuery', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    let id = parseInt(req.query.id);
    let employee = employees.find(emp => emp.id === id);

    if (req.query.view === 'dashboard') {
        const sortKey = req.query.sort || 'id';
        const order = req.query.order || 'asc';
        const filters = {
            search: req.query.id || '',
            designation: req.query.designation || '',
            department: req.query.department || '',
            location: req.query.location || ''
        };

        const dashboardEmployees = employee ? [employee] : [];
        return res.render('dashboard', {
            employees: sortEmployees(dashboardEmployees, sortKey, order),
            currentSort: sortKey,
            currentOrder: order,
            filters,
            msg: employee ? `Showing employee with ID ${id}` : 'Employee not found'
        });
    }

    if (employee) {
        res.json(employee);
    } else {
        res.status(404).json({ message: 'Employee not found' });
    }
});

// search employee by id with path parameter
// http://localhost:3000/api/findEmployeeByIdUsingPath/2
// app.get('/api/findEmployeeByIdUsingPath/:id', (req, res) => {
//     const employees = readJsonArray(employeeFilePath, defaultEmployees);
//     let id = parseInt(req.params.id);
//     let employee = employees.find(emp => emp.id === id);
//     if (employee) {
//         res.json(employee);
//     } else {
//         res.status(404).json({ message: 'Employee not found' });
//     }
// });

// http://localhost:3000/api/addEmployee
app.get('/api/addEmployee', (req, res) => {
    let msg = '';
    res.render('addEmployee', { msg });
});

// http://localhost:3000/api/addEmployee
app.post('/api/addEmployee', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const newEmployee = {
        id: employees.length > 0 ? Math.max(...employees.map(emp => emp.id)) + 1 : 1,
        name: req.body.name || 'New Employee',
        designation: req.body.designation || 'Unknown',
        email: req.body.email || 'Unknown',
        contact: req.body.contact || 'Unknown',
        department: req.body.department || 'Unknown',
        joiningDate: req.body.joiningDate || 'Unknown',
        location: req.body.location || 'Unknown'
    };
    employees.push(newEmployee);
    writeJsonArray(employeeFilePath, employees);
    res.redirect(`/api/dashboard?msg=${encodeURIComponent(`Employee added successfully: ${newEmployee.name}`)}`);
});

// http://localhost:3000/api/updateEmployee/:id
app.get('/api/updateEmployee/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const id = parseInt(req.params.id);
    const employee = employees.find(emp => emp.id === id);
    let msg = '';
    if (employee) {
        res.render('updateEmployee', { employee, msg });
    } else {
        msg = 'Employee not found';
        res.render('updateEmployee', { employee: {}, msg });
    }
});

// http://localhost:3000/api/updateEmployee/:id
app.post('/api/updateEmployee/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const id = parseInt(req.params.id);
    const employeeIndex = employees.findIndex(emp => emp.id === id);
    if (employeeIndex !== -1) {
        employees[employeeIndex] = {
            id,
            name: req.body.name || employees[employeeIndex].name,
            designation: req.body.designation || employees[employeeIndex].designation,
            email: req.body.email || employees[employeeIndex].email,
            contact: req.body.contact || employees[employeeIndex].contact,
            department: req.body.department || employees[employeeIndex].department,
            joiningDate: req.body.joiningDate || employees[employeeIndex].joiningDate,
            location: req.body.location || employees[employeeIndex].location
        };
        writeJsonArray(employeeFilePath, employees);
        res.redirect(`/api/dashboard?msg=${encodeURIComponent(`Employee updated successfully: ${employees[employeeIndex].name}`)}`);
    } else {
        res.status(404).json({ message: 'Employee not found' });
    }
});

app.get('/api/dashboard', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const filters = {
        search: req.query.search || '',
        designation: req.query.designation || '',
        department: req.query.department || '',
        location: req.query.location || ''
    };
    const sortKey = req.query.sort || 'id';
    const order = req.query.order || 'asc';
    const msg = req.query.msg || '';
    const normalizedSearch = String(filters.search || '').trim();
    const searchAsId = Number(normalizedSearch);
    const searchOnlyById = normalizedSearch !== '' && Number.isInteger(searchAsId) && String(searchAsId) === normalizedSearch && !filters.designation && !filters.department && !filters.location;

    if (searchOnlyById) {
        const redirectQuery = new URLSearchParams({
            view: 'dashboard',
            id: normalizedSearch,
            sort: sortKey,
            order,
            designation: filters.designation,
            department: filters.department,
            location: filters.location
        });

        return res.redirect(`/api/findEmployeeByIdUsingQuery?${redirectQuery.toString()}`);
    }

    const filteredEmployees = matchEmployeeSegments(employees, filters);
    const sortedEmployees = sortEmployees(filteredEmployees, sortKey, order);
    
    res.render('dashboard', {
        employees: sortedEmployees,
        currentSort: sortKey,
        currentOrder: order,
        filters,
        msg
    });
});

// http://localhost:3000/api/deleteEmployee/:id
app.get('/api/deleteEmployee/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const id = parseInt(req.params.id);
    const employee = employees.find(emp => emp.id === id);
    let msg = '';
    if (employee) {
        res.render('deleteEmployee', { employee, msg });
    } else {
        msg = 'Employee not found';
        res.render('deleteEmployee', { employee: {}, msg });
    }
});

// http://localhost:3000/api/deleteEmployee/:id
app.post('/api/deleteEmployee/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const id = parseInt(req.params.id);
    const employeeIndex = employees.findIndex(emp => emp.id === id);
    if (employeeIndex !== -1) {
        const deletedName = employees[employeeIndex].name;
        employees.splice(employeeIndex, 1);
        writeJsonArray(employeeFilePath, employees);
        res.redirect(`/api/dashboard?msg=${encodeURIComponent(`Employee deleted successfully: ${deletedName}`)}`);
    } else {
        res.status(404).json({ message: 'Employee not found' });
    }
});

// clicking on an employee name in the dashboard should take you to a page showing that employee's details, with options to update or delete the employee
// http://localhost:3000/api/viewEmployee/:id
app.get('/api/viewEmployee/:id', (req, res) => {
    const employees = readJsonArray(employeeFilePath, defaultEmployees);
    const id = parseInt(req.params.id);
    const employee = employees.find(emp => emp.id === id);
    let msg = '';
    if (employee) {
        res.render('viewEmployee', { employee, msg });
    } else {
        msg = 'Employee not found';
        res.render('viewEmployee', { employee: {}, msg });
    }
});

function sortEmployees(employees, sortKey = 'id', order = 'asc') {
    const sortedEmployees = [...employees];

    sortedEmployees.sort((a, b) => {
        const firstValue = a[sortKey];
        const secondValue = b[sortKey];

        if (typeof firstValue === 'number' && typeof secondValue === 'number') {
            return order === 'desc' ? secondValue - firstValue : firstValue - secondValue;
        }

        const firstText = String(firstValue ?? '').toLowerCase();
        const secondText = String(secondValue ?? '').toLowerCase();

        if (firstText < secondText) {
            return order === 'desc' ? 1 : -1;
        }

        if (firstText > secondText) {
            return order === 'desc' ? -1 : 1;
        }

        return 0;
    });

    return sortedEmployees;
}

function matchEmployeeSegments(employees, filters = {}) {
    const searchTerm = String(filters.search || '').trim().toLowerCase();
    const designationTerm = String(filters.designation || '').trim().toLowerCase();
    const departmentTerm = String(filters.department || '').trim().toLowerCase();
    const locationTerm = String(filters.location || '').trim().toLowerCase();

    return employees.filter(employee => {
        const name = String(employee.name || '').toLowerCase();
        const designation = String(employee.designation || '').toLowerCase();
        const department = String(employee.department || '').toLowerCase();
        const location = String(employee.location || '').toLowerCase();
        const email = String(employee.email || '').toLowerCase();

        const searchMatches =
            !searchTerm ||
            name.includes(searchTerm) ||
            designation.includes(searchTerm) ||
            department.includes(searchTerm) ||
            location.includes(searchTerm) ||
            email.includes(searchTerm);

        const designationMatches = !designationTerm || designation.includes(designationTerm);
        const departmentMatches = !departmentTerm || department.includes(departmentTerm);
        const locationMatches = !locationTerm || location.includes(locationTerm);

        return searchMatches && designationMatches && departmentMatches && locationMatches;
    });
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});