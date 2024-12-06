const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const pdf = require('pdfkit');
const fs = require('fs');
require('dotenv').config();  // Cargar las variables de entorno desde el archivo .env

const app = express();
const port = process.env.PORT || 3000;  // Usa la variable de entorno PORT

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/images', express.static(path.join(__dirname, '..', 'images')));

const dbUrl = process.env.DB_URL;


const db = mysql.createPool(dbUrl);



// Ruta para servir el formulario de inicio de sesión
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'login.html'));
});

// Ruta para autenticar al usuario
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Definir usuario y contraseña
    const validUsername = 'admin';
    const validPassword = 'admin123';

    // Verificar si las credenciales son correctas
    if (username === validUsername && password === validPassword) {
        // Redirigir al panel de administración si las credenciales son correctas
        res.redirect('/admin');
    } else {
        // Si las credenciales son incorrectas, redirigir de nuevo al login
        res.send('<h1>Credenciales incorrectas. Por favor, intenta de nuevo.</h1><a href="/login">Volver a intentar</a>');
    }
});

// Ruta para servir el formulario de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'admin.html'));
});

// Ruta para servir el formulario de usuario
app.get('/usuario', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'usuario.html'));
});

// Obtener todos los animales
app.get('/animales', (req, res) => {
    const query = 'SELECT * FROM animal';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los datos:', err.message);
            return res.status(500).send('Error al obtener los datos.');
        }
        res.json(results);
    });
});

// Agregar un nuevo animal
app.post('/animales', (req, res) => {
    const { Nombre, Especie, Edad, Habitat, dieta, Estado_Conservacion, Pais_Origen, Descripcion } = req.body;

    // Formar la ruta de la imagen del hábitat en función del valor seleccionado
    const Link = `/images/habitats/${Habitat.toLowerCase()}.jpg`; 

    const query = `INSERT INTO animal (Nombre, Especie, Edad, Habitat, dieta, Estado_Conservacion, Pais_Origen, Descripcion, Link)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(query, [Nombre, Especie, Edad, Habitat, dieta, Estado_Conservacion, Pais_Origen, Descripcion, Link], (err, result) => {
        if (err) {
            console.error('Error al insertar los datos:', err.message);
            return res.status(500).send('Error al insertar los datos.');
        }
        res.status(200).send('Animal agregado correctamente.');
    });
});

// Eliminar un animal
app.delete('/animales/:nombre', (req, res) => {
    const nombreAnimal = req.params.nombre;
    const query = 'DELETE FROM animal WHERE Nombre = ?';
    db.query(query, [nombreAnimal], (err, result) => {
        if (err) {
            console.error('Error al eliminar el animal:', err.message);
            return res.status(500).send('Error al eliminar el animal.');
        }
        res.status(200).send(`Animal ${nombreAnimal} eliminado correctamente.`);
    });
});

// Obtener un animal específico por nombre
app.get('/animales/:nombre', (req, res) => {
    const nombreAnimal = req.params.nombre;
    const query = 'SELECT * FROM animal WHERE Nombre = ?';
    db.query(query, [nombreAnimal], (err, results) => {
        if (err) {
            console.error('Error al obtener el animal:', err.message);
            return res.status(500).send('Error al obtener el animal.');
        }

        if (results.length === 0) {
            return res.status(404).send(`No se encontró un animal con el nombre "${nombreAnimal}".`);
        }

        res.json(results[0]);
    });
});

// Ruta para generar el PDF con la imagen del hábitat
app.get('/generar-pdf/:nombre', (req, res) => {
    const nombreAnimal = req.params.nombre;
    const query = 'SELECT * FROM animal WHERE Nombre = ?';
    db.query(query, [nombreAnimal], (err, results) => {
        if (err) {
            console.error('Error al obtener el animal para PDF:', err.message);
            return res.status(500).send('Error al obtener el animal para PDF.');
        }

        if (results.length === 0) {
            return res.status(404).send(`No se encontró un animal con el nombre "${nombreAnimal}".`);
        }

        const animal = results[0];

        // Obtener la ruta de la imagen del hábitat desde la base de datos
        const habitatImagePath = path.join(__dirname, '..', 'images', 'habitats', animal.Link.replace('/images/habitats/', ''));

        // Crear el documento PDF
        const doc = new pdf();
        doc.pipe(res);

        // Agregar título
        doc.fontSize(16).text(`Información del Animal: ${animal.Nombre}`, { align: 'center' });
        doc.moveDown();

        // Agregar la información del animal
        doc.fontSize(12).text(`Especie: ${animal.Especie}`);
        doc.text(`Edad: ${animal.Edad} años`);
        doc.text(`Hábitat: ${animal.Habitat}`);
        doc.text(`Dieta: ${animal.dieta}`);
        doc.text(`Estado de Conservación: ${animal.Estado_Conservacion}`);
        doc.text(`País de Origen: ${animal.Pais_Origen}`);
        doc.text(`Descripción: ${animal.Descripcion}`);
        doc.moveDown();

        // Verificar si la imagen existe
        fs.exists(habitatImagePath, (exists) => {
            if (exists) {
                console.log('Imagen encontrada, agregándola al PDF.');
                doc.image(habitatImagePath, { fit: [500, 400], align: 'center' });
            } else {
                console.log('Imagen no encontrada, mostrando mensaje.');
                doc.text('Imagen del hábitat no disponible.', { align: 'center' });
            }

            // Finalizar documento PDF
            doc.end();
        });
    });
});

app.put('/animales/:nombre', (req, res) => {
    const nombreAnimal = req.params.nombre;
    const { Especie, Edad, Habitat, dieta, Estado_Conservacion, Pais_Origen, Descripcion } = req.body;

    // Verificar que los campos necesarios no estén vacíos
    if (!Especie || !Edad || !Habitat || !dieta || !Estado_Conservacion || !Pais_Origen || !Descripcion) {
        return res.status(400).send('Todos los campos son necesarios para actualizar el animal.');
    }

    const Link = `/images/habitats/${Habitat.toLowerCase()}.jpg`;  

    const query = `UPDATE animal 
                   SET Especie = ?, Edad = ?, Habitat = ?, dieta = ?, Estado_Conservacion = ?, Pais_Origen = ?, Descripcion = ?, Link = ? 
                   WHERE Nombre = ?`;

    db.query(query, [Especie, Edad, Habitat, dieta, Estado_Conservacion, Pais_Origen, Descripcion, Link, nombreAnimal], (err, result) => {
        if (err) {
            console.error('Error al actualizar los datos:', err.message);
            return res.status(500).send('Error al actualizar los datos.');
        }

        if (result.affectedRows === 0) {
            return res.status(404).send(`No se encontró un animal con el nombre "${nombreAnimal}".`);
        }

        res.status(200).send('Animal actualizado correctamente.');
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en ${port}`);
});
