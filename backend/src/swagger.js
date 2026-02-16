import swaggerJSDoc from "swagger-jsdoc";

export default swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Secure Exam API",
      version: "1.0.0",
    },
  },
  apis: ["./src/routes/*.js"],
});
