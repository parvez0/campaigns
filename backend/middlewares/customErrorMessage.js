class CustomErrorMessage extends Error{
    constructor(message, status) {
        super(message);
        this.status = status;
    }

    statusCode() {
        return this.status;
    }
}

module.exports = CustomErrorMessage
