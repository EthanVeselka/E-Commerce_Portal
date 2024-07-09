// SET UP GOOGLE MAPS
function initMap() {
  // the location of the MSC smoothie king
  const smoothieKingCoords = { lat: 30.61229, lng: -96.34104 };

  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: smoothieKingCoords,
  });

  const marker = new google.maps.Marker({
    position: smoothieKingCoords,
    map: map,
  });
}

// SET UP GOOGLE TRANSLATE
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    { pageLanguage: "en" },
    "google_translate_element"
  );
}

// set up the google map
window.initMap = initMap;
