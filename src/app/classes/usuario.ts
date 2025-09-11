export class Usuario {
  constructor(
    public id?: string,
    public email?: string,
    public nombre?: string,
    public apellido?: string,
    public edad?: number,
    public fechaRegistro?: Date,
  ) {}
}
