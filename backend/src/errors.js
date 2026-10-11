// Lỗi có kèm mã HTTP. Ném ra ở bất kỳ đâu, app.js sẽ biến nó thành JSON { error: "..." }.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
module.exports = { HttpError };
