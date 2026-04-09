import dotenv from "dotenv";

dotenv.configDotenv();

const sanitizeString = (variableName: string, value: string | undefined) => {
    if (!value) {
        throw new Error(`Environment variable ${variableName} is not defined`);
    }
    return value as string;
};

const sanitizeNumber = (variableName: string, value: string | undefined) => {
    if (!value) {
        throw new Error(`Environment variable ${variableName} is not defined`);
    }
    const parsed = Number(value);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${variableName} is not a valid number`);
    }
    return parsed;
};

export const env = {
    PORT: sanitizeNumber("PORT", process.env.PORT),
    MONGO_URI: sanitizeString("MONGO_URI", process.env.MONGO_URI)
};
