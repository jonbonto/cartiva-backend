import { IsEmail, IsString, MinLength, Matches, IsNotEmpty } from 'class-validator'

export class SignupDto {
  @IsNotEmpty()
  @IsString()
  name: string

  @IsNotEmpty()
  @IsEmail()
  email: string

  /**
   * Password policy:
   * - Minimum 8 characters
   * - At least 1 uppercase letter
   * - At least 1 number
   */
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  password: string
}
