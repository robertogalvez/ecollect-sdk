package com.ecollect.sdk.types

data class Customer(
    val documentType: String,
    val documentNumber: String,
    val fullName: String,
    val email: String,
    val phone: String,
    val mobileCountryCode: String? = null,
    val customerId: String? = null
)
