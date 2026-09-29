/**
 * Configuración de las pruebas.
 *
 * Se prueban las funciones de cálculo: son puras (entra algo, sale algo, sin
 * pantallas ni red), así que son las más baratas de probar y las que más
 * importa que estén bien, porque de ahí salen todas las cifras que ve el
 * usuario.
 *
 * Correr con:  npm test
 */
module.exports = {
  preset: "jest-expo",
  // Solo los archivos de prueba, no los de ayuda que viven junto a ellos.
  testMatch: ["**/__tests__/**/*.prueba.ts"],
  // El alias @/ que usa la aplicación tiene que funcionar también acá.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/utils/**/*.ts"],
};
