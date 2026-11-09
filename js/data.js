/* =====================================================================
   CONFIGURACIÓN DEL CALENDARIO DE ADVIENTO
   ---------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitas tocar para personalizar el
   regalo. Edita los textos entre comillas y guarda el archivo.

   Consejos:
   - Si un texto contiene comillas simples ('), usa comillas dobles
     para rodearlo, o escribe \' (por ejemplo: 'It\'s magic').
   - Para hacer un salto de línea dentro de un mensaje escribe \n.
   - No borres las comas que separan los elementos.
   ===================================================================== */

window.CONFIG = {
  /* Nombre de la persona que recibe el regalo.
     Aparece en la portada y en la cabecera de la escena. */
  recipientName: 'Lucía',

  /* Dedicatoria que se muestra en la portada, debajo del nombre.
     Puede ser tan larga como quieras (mejor 1-3 frases). */
  dedication:
    'Veinticuatro pequeñas sorpresas, una por cada noche hasta Navidad. ' +
    'Porque cada día contigo merece un poquito de magia.',

  /* Firma opcional que aparece al final de la portada (déjala '' para ocultarla). */
  signature: 'Con todo mi cariño',

  /* VISTA PREVIA: si lo pones a true, todos los regalos se pueden abrir
     sin importar la fecha (útil para revisarlo todo antes de regalarlo).
     ¡Acuérdate de volver a ponerlo a false antes de entregarlo! */
  unlockAll: false,

  /* Los 24 días.
     Cada día tiene:
       - day:     número del día (1 a 24). No lo cambies.
       - title:   título corto que aparece arriba del mensaje.
       - message: el mensaje personal de ese día.
       - photo:   ruta a la foto. Coloca tus fotos en assets/photos/
                  con los nombres dia01.jpg, dia02.jpg … dia24.jpg.
                  Si la foto no existe se mostrará un marco decorativo.
                  Puedes usar otro nombre o formato (p. ej. .png):
                  basta con cambiar aquí la ruta.
  */
  days: [
    { day: 1,  title: 'Empieza la cuenta atrás', message: 'Hoy se enciende la primera lucecita del camino hacia Navidad. Que este diciembre esté lleno de momentos pequeños y bonitos, como tú.', photo: 'assets/photos/dia01.jpg' },
    { day: 2,  title: 'Un copo único',           message: 'Dicen que no hay dos copos de nieve iguales. Tampoco hay nadie como tú: única, irrepetible y preciosa.', photo: 'assets/photos/dia02.jpg' },
    { day: 3,  title: 'Abrazo de bufanda',       message: 'Si hoy hace frío, imagina que este mensaje es una bufanda calentita que te abraza fuerte.', photo: 'assets/photos/dia03.jpg' },
    { day: 4,  title: 'Mi estrella',             message: 'En las noches más largas del año, tú sigues siendo la estrella que me guía de vuelta a casa.', photo: 'assets/photos/dia04.jpg' },
    { day: 5,  title: 'Un recuerdo',             message: '¿Te acuerdas de aquel día en que nos reímos hasta llorar? Lo guardo como uno de mis tesoros favoritos.', photo: 'assets/photos/dia05.jpg' },
    { day: 6,  title: 'Chocolate caliente',      message: 'Vale por una tarde de manta, chocolate caliente y la película que tú elijas. Sin protestar. Prometido.', photo: 'assets/photos/dia06.jpg' },
    { day: 7,  title: 'Luz en la ventana',       message: 'Siempre habrá una luz encendida esperándote. Pase lo que pase, aquí estoy.', photo: 'assets/photos/dia07.jpg' },
    { day: 8,  title: 'Manos calentitas',        message: 'Mi plan favorito del invierno: pasear de la mano contigo aunque se nos congele la nariz.', photo: 'assets/photos/dia08.jpg' },
    { day: 9,  title: 'Lo que más me gusta',     message: 'Me encanta cómo se te iluminan los ojos cuando hablas de lo que te apasiona. No dejes nunca de brillar así.', photo: 'assets/photos/dia09.jpg' },
    { day: 10, title: 'Campanas de invierno',    message: 'Que hoy suene algo bonito en tu día: una canción, una buena noticia o simplemente tu propia risa.', photo: 'assets/photos/dia10.jpg' },
    { day: 11, title: 'Una vela por ti',         message: 'Enciendo una velita por todos tus sueños. Que este año que viene se cumplan unos cuantos.', photo: 'assets/photos/dia11.jpg' },
    { day: 12, title: 'Hogar',                   message: 'Hogar no es un lugar: es la sensación de estar a tu lado. Gracias por ser mi casa.', photo: 'assets/photos/dia12.jpg' },
    { day: 13, title: 'Mitad del camino',        message: '¡Ya vamos por la mitad! Cada día que pasa me gusta más esta cuenta atrás contigo.', photo: 'assets/photos/dia13.jpg' },
    { day: 14, title: 'Dulce como tú',           message: 'Vale por tu postre favorito, preparado (o comprado, no prometo milagros) con todo mi amor.', photo: 'assets/photos/dia14.jpg' },
    { day: 15, title: 'Un regalo dentro de otro', message: 'El mejor regalo que me ha dado la vida no cabe en ninguna caja: eres tú.', photo: 'assets/photos/dia15.jpg' },
    { day: 16, title: 'Bajo la luna',            message: 'Esta noche, cuando mires la luna, piensa que yo también la estoy mirando y pensando en ti.', photo: 'assets/photos/dia16.jpg' },
    { day: 17, title: 'Patitas frías',           message: 'Te dejo permiso oficial para poner los pies fríos sobre mí todo el invierno. (Bueno… casi todo.)', photo: 'assets/photos/dia17.jpg' },
    { day: 18, title: 'Corona de deseos',        message: 'Te deseo calma en los días difíciles, risas en los normales y magia en todos los demás.', photo: 'assets/photos/dia18.jpg' },
    { day: 19, title: 'Abrígate',                message: 'Ponte el gorro, que no quiero que te resfríes. Te quiero sanita y feliz para las fiestas.', photo: 'assets/photos/dia19.jpg' },
    { day: 20, title: 'Deslizarse juntos',       message: 'Aunque a veces resbalemos, contigo hasta las caídas son divertidas. Sigamos patinando juntos.', photo: 'assets/photos/dia20.jpg' },
    { day: 21, title: 'La noche más larga',      message: 'Hoy es la noche más larga del año, y aun así se me hará corta si la paso contigo.', photo: 'assets/photos/dia21.jpg' },
    { day: 22, title: 'Mi ángel',                message: 'Gracias por cuidarme, por escucharme y por estar siempre. Eres mi ángel de la guarda particular.', photo: 'assets/photos/dia22.jpg' },
    { day: 23, title: 'Casi, casi…',             message: 'Mañana es Nochebuena. Esta noche cierra los ojos y pide un deseo: yo ya sé cuál es el mío.', photo: 'assets/photos/dia23.jpg' },
    { day: 24, title: '¡Feliz Nochebuena!',      message: 'Llegamos al final de la cuenta atrás, pero no de la magia. Gracias por compartir este diciembre conmigo. Te quiero muchísimo. ¡Feliz Navidad!', photo: 'assets/photos/dia24.jpg' },
  ],
};

