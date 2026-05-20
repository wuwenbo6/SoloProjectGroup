package com.mockchain.node;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Organization {

    private String name;
    private String nodeUrl;
    private String tesseraUrl;
    private String publicKey;
}