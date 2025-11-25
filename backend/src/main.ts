import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
// import { ApiKeyGuard } from './common/guards/api-key.guard';
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.useGlobalGuards(new ApiKeyGuard(new Reflector()));
  const isProd = process.env.NODE_ENV === "production";
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // read frontend origin from env (FE_URL) — default to localhost:3000 for your setup
  const FRONTEND_ORIGIN =
    process.env.FE_URL ||
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:3000";

  // Allowed origins list (extend if you host frontend on multiple domains)
  const allowedOrigins = isProd
    ? ["https://commitflow.space", FRONTEND_ORIGIN]
    : [FRONTEND_ORIGIN, "http://localhost:3000"];

  // Use array-based origin configuration to avoid runtime callback errors that can
  // cause preflight/connection issues in some Docker environments.
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });

  const config = new DocumentBuilder()
    .setTitle("CommitFlow API")
    .setDescription("Dokumentasi API Otomatis dengan Swagger")
    .setVersion("1.0")
    .addBearerAuth() // jika pakai JWT atau header auth
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  // default port for backend in your Docker setup is 8000
  const port = 3000;
  await app.listen(port, "0.0.0.0");
  console.log(
    `Server listening on port ${port}, allowed frontend origin(s): ${allowedOrigins.join(
      ", "
    )}`
  );
}

bootstrap();
