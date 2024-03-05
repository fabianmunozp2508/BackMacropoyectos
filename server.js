const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const nodemailer = require('nodemailer');
const PORT = 3200;
const app = express();

app.use(cors());
app.use(express.json());

app.post("/consultamidas", async (req, res) => {
  const { numeroPredial } = req.body;
  let browser = null;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Establece un tiempo de espera personalizado para la navegación
    const navigationTimeout = 45000; // 45 segundos
    page.setDefaultNavigationTimeout(navigationTimeout);

    try {
      await page.goto("https://midas.cartagena.gov.co/", {
        waitUntil: "networkidle0",
      });

      // Aceptar la ventana modal
      await page.waitForSelector("ion-button", { timeout: 5000 }).catch(() => {
        throw new Error("Tiempo de espera excedido al buscar botón de modal");
      });
      await page.click("ion-button");
    } catch (error) {
      console.error("Error al cargar la página o al aceptar la ventana modal:", error);
      throw new Error("La página no cargó correctamente o el botón modal no se encontró");
    }

    // Ingresar el número de predial y buscar
    await page.waitForSelector('input[type="search"]', { timeout: 5000 }).catch(() => {
      throw new Error("Tiempo de espera excedido al buscar el campo de búsqueda");
    });
    await page.type('input[type="search"]', numeroPredial);
    await page.keyboard.press("Enter");

    // Esperar a que los resultados estén disponibles y hacer clic en "Predios"
    let prediosButtonFound = false;
    while (!prediosButtonFound) {
      prediosButtonFound = await page.evaluate(() => {
        const prediosButton = Array.from(document.querySelectorAll("h2")).find(
          el => el.textContent.includes("Predios")
        );
        if (prediosButton) {
          prediosButton.click();
          return true;
        }
        return false;
      });
      if (!prediosButtonFound) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Verificar si existen datos después de hacer clic en "Predios"
    const hasData = await page.evaluate(() => {
      const noDataIndicator = document.querySelector(".no-data-indicator-class");
      return !noDataIndicator;
    });

    if (!hasData) {
      throw new Error("No hay datos disponibles para el número predial proporcionado.");
    }

    // Hacer clic en el primer elemento de los resultados
    let firstPlotClicked = false;
    while (!firstPlotClicked) {
      firstPlotClicked = await page.evaluate(() => {
        const firstPredioLink = document.querySelector(".qmap-item-resultado");
        if (firstPredioLink) {
          firstPredioLink.click();
          return true;
        }
        return false;
      });
      if (!firstPlotClicked) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Extraer la información del predio
    const data = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll(
          "div.qmap-line-botton.qmap-background-gray.qmap-item-resultado"
        )
      );
      const data = {};
      items.forEach(item => {
        const label = item.querySelector(".qmap-result-data-label")?.innerText.trim();
        const value =
          item.querySelector(".qmap-result-date-value")?.innerText.trim() || "No disponible";
        if (label) {
          data[label] = value;
        }
      });
      return data;
    });

    // Cierra el navegador
    await browser.close();

    res.json({ message: "Datos extraídos correctamente.", data: data });
  } catch (error) {
    console.error("Error durante la operación de scraping:", error);
    if (browser) await browser.close();
    res.status(500).send("Error en el servidor al hacer scraping: " + error.message);
  }
});



// Configura el transporter de nodemailer
let transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // true para 465, false para otros puertos
  auth: {
    user: 'info@macroproyectoscartagenadeindias.com', // tu dirección de correo de Hostinger
    pass: 'Macro@2508', // tu contraseña de Hostinger
  },
});

app.post('/send-email', async (req, res) => {
  const { name, phone, email, subject } = req.body;

  let mailOptions = {
    from: '"Macroproyectos Cartagena" <info@macroproyectoscartagenadeindias.com>', // dirección del remitente
    to: `macroproyectoscartagena@gmail.com, ${email}`, // lista de destinatarios
    subject: 'Solicitud de información', // Línea de asunto
    text: `Has recibido un nuevo mensaje de: ${name}\nTeléfono: ${phone}\nEmail: ${email}\n`, // cuerpo del texto plano
    html:`Has recibido un nuevo mensaje de: ${name}\nTeléfono: ${phone}\nEmail: ${email}\n`,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    res.send('Email enviado exitosamente');
  } catch (error) {
    console.error('Error al enviar el email:', error);
    res.status(500).send('Error al enviar el email');
  }
});


app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
