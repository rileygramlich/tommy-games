// Card art: public-domain paintings from museum collections, found on Wikimedia
// Commons and cropped to card shape (public/art, 300×420). None of it is drawn
// for this site, and none of it is the art of the published games, which is
// theirs. Credit is not legally required for public-domain work; it is given
// anyway, here and on the rules pages.
const base = import.meta.env.BASE_URL;

const art = (file, title, artist, year, museum, page) =>
  ({ src: `${base}art/${file}.jpg`, title, artist, year, museum, page });

export const ART = {
  duke: art('duke', 'Doge Leonardo Loredan', 'Giovanni Bellini', 'c. 1501', 'National Gallery, London',
    'https://commons.wikimedia.org/wiki/File:Giovanni_Bellini,_portrait_of_Doge_Leonardo_Loredan.jpg'),
  assassin: art('assassin', 'The Bravo', 'Titian', 'c. 1515–20', 'Kunsthistorisches Museum, Vienna',
    'https://commons.wikimedia.org/wiki/File:Tiziano_Vecellio,_gen._Tizian,_Kunsthistorisches_Museum_Wien_-_Der_Bravo_-_GG_64_-_Kunsthistorisches_Museum.jpg'),
  captain: art('captain', 'The Night Watch (Captain Frans Banninck Cocq)', 'Rembrandt', '1642', 'Rijksmuseum, Amsterdam',
    'https://commons.wikimedia.org/wiki/File:The_Nightwatch_Frans_Banninck_Cocq.jpg'),
  ambassador: art('ambassador', 'The Ambassadors (Jean de Dinteville)', 'Hans Holbein the Younger', '1533', 'National Gallery, London',
    'https://commons.wikimedia.org/wiki/File:Ambassadors-Dinteville.jpg'),
  contessa: art('contessa', "Comtesse d'Haussonville", 'Jean-Auguste-Dominique Ingres', '1845', 'The Frick Collection, New York',
    'https://commons.wikimedia.org/wiki/File:Jean-Auguste-Dominique_Ingres_-_Comtesse_d%27Haussonville_-_Google_Art_Project.jpg'),
  inquisitor: art('inquisitor', 'Cardinal Fernando Niño de Guevara, Inquisitor General', 'El Greco', 'c. 1600', 'The Metropolitan Museum of Art, New York',
    'https://commons.wikimedia.org/wiki/File:Cardinal_Fernando_Ni%C3%B1o_de_Guevara_(1541%E2%80%931609)_MET_DT854.jpg'),
  embezzler: art('embezzler', 'The Tax Collectors', 'after Marinus van Reymerswaele', '1600s', 'National Museum in Warsaw',
    'https://commons.wikimedia.org/wiki/File:Marinus_Claeszoon_van_Reymerswaele_-_Tax_collectors_-_M.Ob.592_MNW_-_National_Museum_in_Warsaw.jpg'),
  wizard: art('wizard', 'The Magic Circle', 'John William Waterhouse', '1886', 'Tate Britain, London',
    'https://commons.wikimedia.org/wiki/File:John_William_Waterhouse_-_Magic_Circle.JPG'),
  jester: art('jester', 'Stańczyk', 'Jan Matejko', '1862', 'National Museum in Warsaw',
    'https://commons.wikimedia.org/wiki/File:Jan_Matejko_-_Sta%C5%84czyk_-_Google_Art_Project.jpg')
};
