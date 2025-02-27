import { Component } from '@angular/core';
import { HttpService } from '../../services/http.service';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormControl,
} from '@angular/forms';
import { inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private service: HttpService = inject(HttpService);
  public form!: FormGroup;
  public builder: FormBuilder = inject(FormBuilder);
  public error!: string;
  public registerForm!: FormGroup;
  public loading = false;
  public success!: string;
  public router: Router = inject(Router);

  constructor() {}

  handleSubmit() {
    this.loading = true;
    this.service
      .registerUser(
        this.form.value.username,
        this.form.value.email,
        this.form.value.password
      )
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.success = 'User registered successfully!';
          this.form.reset();
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.loading = false;
          this.error = 'Something went wrong, please try again later.';
          console.log(err.error.message);
          this.form.enable();
        },
      });
  }

  ngOnInit() {
    this.buildForm();
  }

  buildForm() {
    this.form = new FormGroup({
      username: new FormControl('', [
        Validators.required,
        Validators.minLength(3),
      ]),
      email: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
  }

  get f() {
    return this.form.controls;
  }
}
