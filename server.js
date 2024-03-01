const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const PORT = 3200;
const app = express();

app.use(cors());
app.use(express.json());

app.post("/consultamidas", async (req, res) => {
    const { numeroPredial } = req.body;
    let browser = null;
    try {
      browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();
      await page.goto('https://midas.cartagena.gov.co/', { waitUntil: 'networkidle0' });
  
      // Aceptar la ventana modal
      try {
        await page.waitForSelector("ion-button");
        await page.click("ion-button");
      } catch (error) {
        console.error("Error al aceptar la ventana modal:", error);
      }
  
      // Ingresar el número de predial y buscar
      try {
        await page.waitForSelector('input[type="search"]');
        await page.type('input[type="search"]', numeroPredial);
        await page.keyboard.press('Enter');
      } catch (error) {
        console.error("Error al ingresar el número predial:", error);
      }
  
      // Esperar a que los resultados estén disponibles y hacer clic en "Predios"
      let prediosButtonFound = false;
      while (!prediosButtonFound) {
        prediosButtonFound = await page.evaluate(() => {
          const prediosButton = Array.from(document.querySelectorAll('h2')).find(el => el.textContent.includes('Predios'));
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
  
      // Hacer clic en el primer elemento de los resultados
      let firstPlotClicked = false;
      while (!firstPlotClicked) {
        firstPlotClicked = await page.evaluate(() => {
          const firstPredioLink = document.querySelector('.qmap-item-resultado'); // Usa la clase para seleccionar el primer predio
          if (firstPredioLink) {
            firstPredioLink.click();
            return true;
          }
          return false;
        });
        if (!firstPlotClicked) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Espera un segundo antes de reintentar
        }
      }
  
      // Extraer la información del predio
      // Extraer la información del predio
try {
    await page.waitForSelector("div.qmap-line-botton.qmap-background-gray.qmap-item-resultado"); // Espera a que el elemento esté presente
    const data = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("div.qmap-line-botton.qmap-background-gray.qmap-item-resultado"));
      const data = {};
  
      items.forEach(item => {
        const label = item.querySelector(".qmap-result-data-label")?.innerText.trim();
        const value = item.querySelector(".qmap-result-date-value")?.innerText.trim() || "No disponible";
        if (label) {
          data[label] = value;
        }
      });
  
      return data;
    });
  
        // Cierra el navegador
        // await browser.close();
        console.log( "Datos extraídos correctamente.", data )
        res.json({ message: "Datos extraídos correctamente.", data: data });
      } catch (error) {
        console.error("Error al extraer información del predio:", error);
        if (browser) await browser.close();
        res.status(500).send("Error en el servidor al hacer scraping: " + error.message);
      }
    } catch (error) {
      console.error("Error general en el scraping:", error);
      if (browser) await browser.close();
      res.status(500).send("Error en el servidor al hacer scraping: " + error.message);
    }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
